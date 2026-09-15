// Base → Stellar burn (the REFUND path of an outbound swap, and the inbound
// direction later) — port of web lib/cctp/burn-evm.ts: approve (if needed) +
// depositForBurnWithHook on Circle's TokenMessengerV2, signed with the
// Turnkey EVM key. Hard rule 10, mistake = permanent loss:
//   mintRecipient = CctpForwarder · destinationCaller = CctpForwarder ·
//   the real G-address ONLY in hookData. The recipient's USDC trustline must
//   already exist.

import { encodeFunctionData, serializeTransaction } from "viem";
import { base } from "viem/chains";

import { signWithRetryEvm } from "@/lib/send/evm";
import { createPasskeyClient } from "@/lib/turnkey/client";
import { baseClient, readUsdcView } from "./base";
import {
  BASE_USDC,
  CCTP_DOMAIN,
  CCTP_MAX_FEE,
  CCTP_MIN_FINALITY_THRESHOLD,
  ERC20_MIN_ABI,
  EVM_CCTP,
  STELLAR_CCTP,
  bytesToHex,
  encodeStellarHookData,
  stellarContractToBytes32
} from "./config";

const DEPOSIT_FOR_BURN_WITH_HOOK_ABI = [
  {
    type: "function",
    name: "depositForBurnWithHook",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
      { name: "hookData", type: "bytes" }
    ],
    outputs: []
  }
] as const;

const MAX_UINT256 = BigInt(`0x${"f".repeat(64)}`);

export const burnUsdcOnBase = async (p: {
  subOrgId: string;
  evmAddress: string;
  amountWire: bigint;
  stellarRecipient: string;
  onStep?: (step: "approve" | "burn") => void;
}): Promise<{ approveTxHash: `0x${string}` | null; burnTxHash: `0x${string}` }> => {
  if (!/^G[A-Z2-7]{55}$/.test(p.stellarRecipient)) throw new Error("refusing to burn: invalid Stellar recipient address");
  const client = baseClient();
  const from = p.evmAddress as `0x${string}`;
  const tokenMessenger = EVM_CCTP.tokenMessengerV2;
  const turnkey = await createPasskeyClient();

  const signAndSend = async (to: `0x${string}`, data: `0x${string}`, label: string): Promise<`0x${string}`> => {
    let hash: `0x${string}` | null = null;
    for (let attempt = 0; hash === null; attempt += 1) {
      const [nonce, fees, gas] = await Promise.all([
        client.getTransactionCount({ address: from, blockTag: "pending" }),
        client.estimateFeesPerGas(),
        client.estimateGas({ account: from, to, data })
      ]);
      const unsigned = serializeTransaction({
        chainId: base.id,
        type: "eip1559",
        nonce,
        to,
        data,
        gas: (gas * 12n) / 10n,
        maxFeePerGas: fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas
      });
      const signed = await signWithRetryEvm(() =>
        turnkey.signTransaction({
          type: "ACTIVITY_TYPE_SIGN_TRANSACTION_V2",
          timestampMs: String(Date.now()),
          organizationId: p.subOrgId,
          parameters: { signWith: p.evmAddress, unsignedTransaction: unsigned.slice(2), type: "TRANSACTION_TYPE_ETHEREUM" }
        })
      );
      try {
        hash = await client.sendRawTransaction({ serializedTransaction: (signed.startsWith("0x") ? signed : `0x${signed}`) as `0x${string}` });
      } catch (e) {
        const m = String((e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? "");
        if (attempt === 0 && /nonce too low|already known|replacement transaction underpriced/i.test(m)) continue;
        throw e;
      }
    }
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`${label} reverted (${hash})`);
    return hash;
  };

  const readAllowance = () => readUsdcView("allowance", [from, tokenMessenger]);

  let approveTxHash: `0x${string}` | null = null;
  if ((await readAllowance()) < p.amountWire) {
    p.onStep?.("approve");
    approveTxHash = await signAndSend(BASE_USDC, encodeFunctionData({ abi: ERC20_MIN_ABI, functionName: "approve", args: [tokenMessenger, MAX_UINT256] }), "approve");
    for (let i = 0; i < 15; i += 1) {
      if ((await readAllowance()) >= p.amountWire) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  p.onStep?.("burn");
  const forwarder = stellarContractToBytes32(STELLAR_CCTP.cctpForwarder);
  const burnData = encodeFunctionData({
    abi: DEPOSIT_FOR_BURN_WITH_HOOK_ABI,
    functionName: "depositForBurnWithHook",
    args: [p.amountWire, CCTP_DOMAIN.stellar, forwarder, BASE_USDC, forwarder, CCTP_MAX_FEE, CCTP_MIN_FINALITY_THRESHOLD, bytesToHex(encodeStellarHookData(p.stellarRecipient))]
  });
  let burnTxHash: `0x${string}` | undefined;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      burnTxHash = await signAndSend(tokenMessenger, burnData, "depositForBurnWithHook");
      break;
    } catch (e) {
      const msg = String((e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? e);
      if (attempt < 3 && /allowance/i.test(msg)) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      throw e;
    }
  }
  return { approveTxHash, burnTxHash: burnTxHash! };
};
