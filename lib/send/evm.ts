// Native ETH send — port of web send-adapters/ethereum.ts. The unsigned
// EIP-1559 tx is built locally with viem, signed by Turnkey via the passkey
// (SIGN_TRANSACTION_V2 / TRANSACTION_TYPE_ETHEREUM), and broadcast through
// POST /api/send/execute — which records the send BEFORE relaying it and
// answers 409 while a previous send's outcome is unknown (double-send guard).

import { createPublicClient, http, parseEther, serializeTransaction } from "viem";
import { mainnet } from "viem/chains";

import { ApiError, apiFetch } from "@/lib/api";
import { signWithRetry } from "@/lib/savings/engine";
import { createPasskeyClient } from "@/lib/turnkey/client";

export const ETH_RPC_URL = process.env.EXPO_PUBLIC_ETH_RPC_URL || "https://ethereum-rpc.publicnode.com";
/** Kept back for the send's own gas (21000 gas with generous headroom). */
export const GAS_RESERVE_ETH = 0.0005;

export const isValidEthAddress = (a: string) => /^0x[a-fA-F0-9]{40}$/.test(a);

export const spendableEth = (balance: number) => Math.max(balance - GAS_RESERVE_ETH, 0);

export interface SendExecuteResponse {
  success: boolean;
  txHash?: string;
  confirming?: boolean;
  error?: string;
}

/** POST send/execute; a 409 means an earlier send is still unsettled. */
export const executeSend = async (body: {
  chain: "ethereum" | "solana";
  signedTx: string;
  symbol: string;
  amount: string;
  destination: string;
}): Promise<string> => {
  try {
    const data = await apiFetch<SendExecuteResponse>("/api/send/execute", { body });
    if (!data?.success || !data.txHash) throw new Error(data?.error || "Send failed. Please try again.");
    return data.txHash;
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      throw new Error("Your previous send is still confirming. Wait a moment and try again.");
    }
    throw e;
  }
};

export const sendEth = async ({
  subOrgId,
  from,
  to,
  amount,
  balance,
  onStep
}: {
  subOrgId: string;
  from: string;
  to: string;
  amount: number;
  balance: number;
  onStep?: (s: "checking" | "building" | "signing" | "submitting") => void;
}): Promise<string> => {
  if (!isValidEthAddress(to)) throw new Error("Enter a valid Ethereum address (0x…).");
  onStep?.("checking");
  const client = createPublicClient({ chain: mainnet, transport: http(ETH_RPC_URL) });
  const account = from as `0x${string}`;
  const destination = to as `0x${string}`;
  const value = parseEther(amount.toFixed(18).replace(/\.?0+$/, ""));

  // Ask the network what THIS send costs (#29): a contract destination
  // (exchange deposit addresses, smart wallets) costs more than 21000; an
  // estimation revert means it cannot accept plain ETH — block before signing.
  let gasEstimate: bigint;
  try {
    gasEstimate = await client.estimateGas({ account, to: destination, value });
  } catch {
    throw new Error(
      "This address cannot accept ETH directly. Double-check the destination — if it is an exchange, use its ETH deposit address, not a contract address."
    );
  }
  const gas = (gasEstimate * 12n) / 10n;
  const [nonce, fees] = await Promise.all([
    client.getTransactionCount({ address: account, blockTag: "pending" }),
    client.estimateFeesPerGas()
  ]);
  const feeWei = gas * fees.maxFeePerGas;
  const balanceWei = parseEther(balance.toFixed(18).replace(/\.?0+$/, ""));
  if (value + feeWei > balanceWei) {
    const shortEth = Number(value + feeWei - balanceWei) / 1e18;
    throw new Error(`Amount plus network fee exceeds your balance. Reduce the amount by about ${shortEth.toFixed(6)} ETH.`);
  }

  onStep?.("building");
  const unsigned = serializeTransaction({
    chainId: mainnet.id,
    type: "eip1559",
    nonce,
    to: destination,
    value,
    gas,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas
  });

  onStep?.("signing");
  const turnkey = await createPasskeyClient();
  const signedTx = await signWithRetryEvm(() =>
    turnkey.signTransaction({
      type: "ACTIVITY_TYPE_SIGN_TRANSACTION_V2",
      timestampMs: String(Date.now()),
      organizationId: subOrgId,
      parameters: {
        signWith: from,
        unsignedTransaction: unsigned.startsWith("0x") ? unsigned.slice(2) : unsigned, // Turnkey wants no 0x
        type: "TRANSACTION_TYPE_ETHEREUM"
      }
    })
  );

  onStep?.("submitting");
  return executeSend({
    chain: "ethereum",
    signedTx: signedTx.startsWith("0x") ? signedTx : `0x${signedTx}`,
    symbol: "ETH",
    amount: String(amount),
    destination: to
  });
};

/** Same retry shape as signWithRetry (lib/savings/engine.ts), for the
 *  signTransaction activity. Exported for the Bitcoin path too. */
export const signWithRetryEvm = async (
  run: () => Promise<{ activity?: { result?: { signTransactionResult?: { signedTransaction?: string } } } }>
): Promise<string> => {
  const attempt = async () => {
    const r = await run();
    const signed = r?.activity?.result?.signTransactionResult?.signedTransaction;
    if (!signed) throw new Error("Signing failed — no signed transaction returned");
    return signed;
  };
  try {
    return await attempt();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const name = (e as { error?: string })?.error ?? "";
    if (name === "UserCancelled" || !/timed out|not allowed|TimedOut/i.test(msg)) throw e;
    await new Promise((r) => setTimeout(r, 600));
    return attempt();
  }
};

// Re-export so callers can keep one import for the Stellar signer's retry.
export { signWithRetry };
