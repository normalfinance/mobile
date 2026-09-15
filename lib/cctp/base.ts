// Base-chain legs of the outbound route — port of web lib/cctp/pivot-swap.ts
// (+ the EVM signer, the top-up wait, and the pollPivotDelivery / readBaseUsdc
// helpers from use-cctp-engine.tsx). Executed from the user's OWN Base address
// with their Turnkey passkey; the relayer's gas top-up must have landed first.
//   1. LI.FI quote USDC(Base) → BTC/ETH/SOL delivered to the user's address
//   2. ERC-20 approve to LI.FI's router (first time / insufficient allowance)
//   3. sign + broadcast LI.FI's transactionRequest on Base

import { createPublicClient, encodeFunctionData, fallback, http, serializeTransaction } from "viem";
import { base } from "viem/chains";

import { apiFetch } from "@/lib/api";
import { signWithRetryEvm } from "@/lib/send/evm";
import { createPasskeyClient } from "@/lib/turnkey/client";
import { BASE_RPC_URLS, BASE_USDC, ERC20_MIN_ABI, type CrosschainSymbol } from "./config";

// `**` on a BigInt transpiles to Math.pow and throws — hex literal instead.
const MAX_UINT256 = BigInt(`0x${"f".repeat(64)}`);

export const baseClient = () => createPublicClient({ chain: base, transport: fallback(BASE_RPC_URLS.map((u) => http(u))) });

/** ERC-20 view call on Base USDC. The cast is a TS-resolution artifact only:
 *  viem's ReadContractParameters resolves with `authorizationList` required
 *  under this project's module resolution (web compiles the same call). */
export const readUsdcView = (fn: "balanceOf" | "allowance", args: `0x${string}`[]): Promise<bigint> =>
  (baseClient().readContract as (p: unknown) => Promise<bigint>)({ address: BASE_USDC, abi: ERC20_MIN_ABI, functionName: fn, args });

export const readBaseUsdc = (address: string): Promise<bigint> => readUsdcView("balanceOf", [address as `0x${string}`]);

export const readBaseEth = (address: string): Promise<bigint> => baseClient().getBalance({ address: address as `0x${string}` });

export class PivotRevertError extends Error {
  __pivotRevert = true;
  txHash: string;
  tool: string | null;
  exchanges: string[];
  constructor(txHash: string, tool: string | null, exchanges: string[]) {
    super(`transaction reverted (${txHash})`);
    this.txHash = txHash;
    this.tool = tool;
    this.exchanges = exchanges;
  }
}

export interface PivotSwapResult {
  txHash: `0x${string}`;
  toAmountMin: string;
  etaSeconds: number;
  fromChainId?: number;
  toChainId?: number;
}

/** Sign an EIP-1559 tx on Base with Turnkey and broadcast it, with the web's
 *  nonce-race guard (one rebuild + one more signature) and revert
 *  classification (a revert is an on-chain outcome, never re-prompted). */
const signAndSend = async (p: {
  subOrgId: string;
  from: `0x${string}`;
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
  gasHint?: bigint;
  revertMeta?: { tool: string | null; exchanges: string[] };
}): Promise<`0x${string}`> => {
  const client = baseClient();
  const turnkey = await createPasskeyClient();
  let hash: `0x${string}` | null = null;
  for (let attempt = 0; hash === null; attempt += 1) {
    const [nonce, fees, gas] = await Promise.all([
      client.getTransactionCount({ address: p.from, blockTag: "pending" }),
      client.estimateFeesPerGas(),
      p.gasHint ? Promise.resolve(p.gasHint) : client.estimateGas({ account: p.from, to: p.to, data: p.data, value: p.value })
    ]);
    const unsigned = serializeTransaction({
      chainId: base.id,
      type: "eip1559",
      nonce,
      to: p.to,
      data: p.data,
      value: p.value,
      gas: (gas * 12n) / 10n,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas
    });
    const signed = await signWithRetryEvm(() =>
      turnkey.signTransaction({
        type: "ACTIVITY_TYPE_SIGN_TRANSACTION_V2",
        timestampMs: String(Date.now()),
        organizationId: p.subOrgId,
        parameters: { signWith: p.from, unsignedTransaction: unsigned.slice(2), type: "TRANSACTION_TYPE_ETHEREUM" }
      })
    );
    const raw = (signed.startsWith("0x") ? signed : `0x${signed}`) as `0x${string}`;
    try {
      hash = await client.sendRawTransaction({ serializedTransaction: raw });
    } catch (e) {
      const m = String((e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? "");
      if (attempt === 0 && /nonce too low|already known|replacement transaction underpriced/i.test(m)) continue;
      throw e;
    }
  }
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new PivotRevertError(hash, p.revertMeta?.tool ?? null, p.revertMeta?.exchanges ?? []);
  return hash;
};

interface LifiQuoteResponse {
  success: boolean;
  error?: string;
  feePercent?: number;
  quote?: {
    tool?: string;
    toolDetails?: { key?: string };
    includedSteps?: { type?: string; tool?: string }[];
    action?: { fromChainId?: number; toChainId?: number };
    estimate?: { toAmountMin?: string; toAmount?: string; approvalAddress?: `0x${string}`; executionDuration?: number };
    transactionRequest?: { to?: `0x${string}`; data?: `0x${string}`; value?: string; gasLimit?: string };
  };
}

/** LI.FI quote Base USDC → target, delivered to the user's own address.
 *  Public route (IP-limited); one retry on 429/5xx. */
export const lifiPivotQuote = async (p: {
  evmAddress: string;
  toSymbol: CrosschainSymbol;
  toAddress: string;
  amountWire: bigint;
  denyBridges?: string[];
  denyExchanges?: string[];
}): Promise<LifiQuoteResponse> => {
  let data: LifiQuoteResponse | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const lastResort = attempt === 2; // drop deny lists: a once-failed bridge beats no route
    try {
      data = await apiFetch<LifiQuoteResponse>("/api/lifi/quote", {
        anonymous: true,
        body: {
          fromSymbol: "USDC_BASE",
          toSymbol: p.toSymbol,
          fromAmount: p.amountWire.toString(),
          fromAddress: p.evmAddress,
          toAddress: p.toAddress,
          denyBridges: lastResort ? undefined : p.denyBridges,
          denyExchanges: lastResort ? undefined : p.denyExchanges
        }
      });
      if (data?.success) return data;
    } catch (e) {
      data = { success: false, error: e instanceof Error ? e.message : String(e) };
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  return data ?? { success: false, error: "No route from Base — try again shortly" };
};

/** Approve (if needed) + LI.FI swap on Base. 1–2 passkey prompts. */
export const executePivotSwap = async (p: {
  subOrgId: string;
  evmAddress: string;
  toSymbol: CrosschainSymbol;
  toAddress: string;
  amountWire: bigint;
  denyBridges?: string[];
  denyExchanges?: string[];
  onStep?: (step: "quote" | "approve" | "swap") => void;
}): Promise<PivotSwapResult> => {
  p.onStep?.("quote");
  const data = await lifiPivotQuote(p);
  if (!data.success || !data.quote) throw new Error(data.error ?? "No route from Base — try again shortly");
  const quote = data.quote;
  const txr = quote.transactionRequest;
  if (!txr?.to || !txr?.data) throw new Error("LI.FI returned no executable transaction");
  const from = p.evmAddress as `0x${string}`;
  const revertMeta = {
    tool: quote.tool ?? quote.toolDetails?.key ?? null,
    exchanges: (quote.includedSteps ?? []).filter((st) => st?.type === "swap" && typeof st?.tool === "string").map((st) => st.tool as string)
  };

  const approvalAddress = quote.estimate?.approvalAddress;
  if (approvalAddress) {
    const allowance = await readUsdcView("allowance", [from, approvalAddress]);
    if (allowance < p.amountWire) {
      p.onStep?.("approve");
      await signAndSend({
        subOrgId: p.subOrgId,
        from,
        to: BASE_USDC,
        data: encodeFunctionData({ abi: ERC20_MIN_ABI, functionName: "approve", args: [approvalAddress, MAX_UINT256] }),
        value: 0n
      });
    }
  }

  p.onStep?.("swap");
  const txHash = await signAndSend({
    subOrgId: p.subOrgId,
    from,
    to: txr.to,
    data: txr.data,
    value: BigInt(txr.value ?? "0"),
    gasHint: txr.gasLimit ? BigInt(txr.gasLimit) : undefined,
    revertMeta
  });
  return {
    txHash,
    toAmountMin: quote.estimate?.toAmountMin ?? "0",
    etaSeconds: quote.estimate?.executionDuration ?? 300,
    fromChainId: quote.action?.fromChainId,
    toChainId: quote.action?.toChainId
  };
};

/** Follow the pivot's Base → destination bridge to delivery via lifi/status
 *  (10s polls). null = timed out, merely slow. */
export const pollPivotDelivery = async (
  txHash: string,
  fromChainId: number,
  toChainId: number,
  maxPolls: number,
  isCancelled: () => boolean
): Promise<{ verdict: "DONE" | "REFUNDED" | "FAILED" | null; deliveredAmount: string | null }> => {
  for (let i = 0; i < maxPolls; i += 1) {
    if (isCancelled()) throw new Error("cancelled");
    try {
      const data = await apiFetch<{ status?: { status?: string; substatus?: string; receiving?: { amount?: unknown; token?: { decimals?: unknown } } } }>(
        "/api/lifi/status",
        { query: { txHash, fromChain: fromChainId, toChain: toChainId } }
      );
      const s = data?.status?.status;
      const sub = String(data?.status?.substatus ?? "").toUpperCase();
      const deliveredAmount = parseDeliveredAmount(data?.status?.receiving);
      if (s === "DONE") return { verdict: sub === "REFUNDED" || sub === "PARTIAL" ? "REFUNDED" : "DONE", deliveredAmount };
      if (s === "FAILED" || s === "INVALID") return { verdict: "FAILED", deliveredAmount: null };
    } catch {
      /* transient — retry next interval */
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }
  return { verdict: null, deliveredAmount: null };
};

/** Web delivered-amount.ts: the truth the destination received, or null. */
const parseDeliveredAmount = (receiving: { amount?: unknown; token?: { decimals?: unknown } | null } | null | undefined): string | null => {
  if (!receiving || receiving.amount == null) return null;
  const raw = String(receiving.amount);
  if (!/^\d+$/.test(raw)) return null;
  const decimals = Number(receiving.token?.decimals);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;
  const s = raw.padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals) || "0";
  const frac = s.slice(s.length - decimals).replace(/0+$/, "");
  const value = frac ? `${whole}.${frac}` : whole;
  return Number(value) > 0 ? value : null;
};
