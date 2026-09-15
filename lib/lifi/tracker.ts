// Tracks a LI.FI native ⇄ native swap after its source transaction is
// broadcast — port of web sections/swap/engines/lifi-tracker.ts as a plain
// async function so the run store (not a screen) owns it:
//   1. confirm the source tx (ETH receipt ×45/4s, SOL status ×30/2s, BTC =
//      broadcast acceptance is enough — the bridge watches the mempool)
//   2. POST lifi/record — the swap's ONLY activity row; 3 attempts
//   3. poll lifi/status every 15s; DONE+REFUNDED / PARTIAL = refunded,
//      FAILED / INVALID = failed. Budget = the destination chain's settlement
//      window × 1.5 (web polls a flat 80 × 15s ≈ 20 min, which a Bitcoin
//      destination — up to 60 min — routinely exhausts; agreed with the web
//      side 2026-09-16 to derive it like the CCTP delivery watch instead)
//   4. on DONE, `onArrival` (destination-chain refetch) is awaited, capped 15s,
//      BEFORE reporting done (hard rule 14)
// Terminal verdicts are also registered as session overrides so the feed can
// show the truth before the server's 30s statuses cache catches up.

import { ApiError, apiFetch } from "@/lib/api";
import { SETTLEMENT_MAX_MINUTES } from "@/lib/cctp/config";
import { ETH_RPC_URL } from "@/lib/send/evm";
import { SOL_RPC_URL } from "@/lib/send/solana";
import { LIFI_CHAIN_IDS, lifiSourceVerdict } from "./execute";

export type LifiStage = "confirming" | "bridging" | "done" | "failed" | "refunded" | "pending-long";

export interface LifiTrackedTx {
  txHash: string;
  fromChainId: number;
  toChainId: number;
  fromSymbol: string;
  toSymbol: string;
  amountIn: string;
  amountOut: string;
  /** Integrator fee in source-token units — absent when the quote carried none. */
  feeAmount?: string;
}

export const lifiChainName = (id: number): string =>
  id === LIFI_CHAIN_IDS.ETH ? "Ethereum" : id === LIFI_CHAIN_IDS.SOL ? "Solana" : id === LIFI_CHAIN_IDS.BTC ? "Bitcoin" : "source chain";

// --- session-local status overrides (web lib/lifi/status-overrides.ts) -----
export type LifiTerminalStatus = "DONE" | "FAILED" | "REFUNDED";
const overrides = new Map<string, LifiTerminalStatus>();
export const registerLifiStatusOverride = (txHash: string, status: LifiTerminalStatus): void => {
  overrides.set(txHash.toLowerCase(), status);
};
export const getLifiStatusOverride = (txHash: string): LifiTerminalStatus | undefined => overrides.get(txHash.toLowerCase());

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const rpc = async (url: string, method: string, params: unknown[]): Promise<any> => {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  if (!res.ok) throw new Error(`rpc ${method} ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? method);
  return data.result;
};
const rpcMulti = async (urls: string[], method: string, params: unknown[]): Promise<any> => {
  let lastErr: unknown;
  for (const url of urls) {
    try {
      return await rpc(url, method, params);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
};
const ETH_URLS = [ETH_RPC_URL, "https://ethereum-rpc.publicnode.com"];
const SOL_URLS = [SOL_RPC_URL, "https://solana-rpc.publicnode.com"];

/** 'confirmed' | 'reverted' | 'dropped' */
export const confirmLifiSource = async (fromChainId: number, txHash: string, stop: () => boolean = () => false): Promise<"confirmed" | "reverted" | "dropped"> => {
  if (fromChainId === LIFI_CHAIN_IDS.BTC) return "confirmed";
  if (fromChainId === LIFI_CHAIN_IDS.ETH) {
    for (let i = 0; i < 45 && !stop(); i += 1) {
      try {
        const receipt = await rpcMulti(ETH_URLS, "eth_getTransactionReceipt", [txHash]);
        if (receipt) return receipt.status === "0x1" ? "confirmed" : "reverted";
      } catch {
        /* poll error — retry */
      }
      await delay(4_000);
    }
    return "dropped";
  }
  if (fromChainId === LIFI_CHAIN_IDS.SOL) {
    for (let i = 0; i < 30 && !stop(); i += 1) {
      try {
        const res = await rpcMulti(SOL_URLS, "getSignatureStatuses", [[txHash]]);
        const st = res?.value?.[0];
        if (st) {
          if (st.err) return "reverted";
          if (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized") return "confirmed";
        }
      } catch {
        /* poll error — retry */
      }
      await delay(2_000);
    }
    return "dropped";
  }
  return "confirmed";
};

/** POST lifi/record — three attempts; funds left the wallet, so one failed POST
 *  must not erase the row. Retries on 5xx / network only: the route has no
 *  dedupe on txHash (a second accepted post = a second row), and a 4xx is a
 *  rejection, not a hiccup. (apiFetch throws on every non-2xx — web's fetch
 *  only retried thrown errors and silently lost the row on a 500.) */
export const recordLifiSwap = async (tx: LifiTrackedTx, stellarAddress?: string): Promise<void> => {
  const { fromSymbol, toSymbol, amountIn, amountOut, txHash, feeAmount } = tx;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await apiFetch("/api/lifi/record", { body: { fromSymbol, toSymbol, amountIn, amountOut, txHash, feeAmount } });
      return;
    } catch (e) {
      if (e instanceof ApiError && e.status < 500) return;
      // A network failure is the AMBIGUOUS case: the create may have committed
      // and only the response was lost. Read back (wallet/activity is
      // confirmed-only and uncached) before posting again.
      if (!(e instanceof ApiError) && stellarAddress && (await hasSwapRow(stellarAddress, txHash))) return;
      await delay(4_000 * (attempt + 1));
    }
  }
};

const hasSwapRow = async (stellarAddress: string, txHash: string): Promise<boolean> => {
  try {
    const d = await apiFetch<{ items?: { kind: string; txHash: string | null }[] }>("/api/wallet/activity", { query: { walletAddress: stellarAddress, limit: 50 } });
    return (d?.items ?? []).some((i) => i.kind === "swap" && i.txHash?.toLowerCase() === txHash.toLowerCase());
  } catch {
    return false;
  }
};

const POLL_MS = 15_000;
/** Polls until the destination chain's settlement window × 1.5 has passed; never fewer than web's 80. */
const pollBudget = (toSymbol: string): number => {
  const maxMin = SETTLEMENT_MAX_MINUTES[toSymbol as keyof typeof SETTLEMENT_MAX_MINUTES];
  return Math.max(80, maxMin ? Math.ceil((maxMin * 60 * 1.5 * 1000) / POLL_MS) : 0);
};

const pollBridge = async (tx: LifiTrackedTx, stop: () => boolean): Promise<"DONE" | "FAILED" | "REFUNDED" | null> => {
  const budget = pollBudget(tx.toSymbol);
  for (let i = 0; i < budget && !stop(); i += 1) {
    const v = await lifiSourceVerdict(tx.txHash, tx.fromChainId, tx.toChainId);
    if (v) return v;
    await delay(POLL_MS);
  }
  return null;
};

const ARRIVAL_CAP_MS = 15_000;

export const trackLifiSwap = async (
  tx: LifiTrackedTx,
  h: { onStage: (s: LifiStage) => void; onRecorded?: () => void; onArrival?: () => Promise<void> | void; stop?: () => boolean; stellarAddress?: string }
): Promise<LifiStage> => {
  const stop = h.stop ?? (() => false);
  h.onStage("confirming");
  const src = await confirmLifiSource(tx.fromChainId, tx.txHash, stop);
  if (src !== "confirmed") {
    h.onStage("failed");
    return "failed";
  }
  await recordLifiSwap(tx, h.stellarAddress);
  h.onRecorded?.();

  h.onStage("bridging");
  const bridge = await pollBridge(tx, stop);
  const final: LifiStage = bridge === "DONE" ? "done" : bridge === "REFUNDED" ? "refunded" : bridge === "FAILED" ? "failed" : "pending-long";
  if (final === "done" && h.onArrival) {
    try {
      await Promise.race([Promise.resolve(h.onArrival()), delay(ARRIVAL_CAP_MS)]);
    } catch {
      /* funds ARE on-chain once the bridge says DONE — show done regardless */
    }
  }
  if (final !== "pending-long") registerLifiStatusOverride(tx.txHash, final === "done" ? "DONE" : final === "refunded" ? "REFUNDED" : "FAILED");
  h.onStage(final);
  return final;
};

/** Batch statuses for feed rows: `{ [txHash]: 'DONE' | 'PENDING' | 'FAILED' | 'REFUNDED' | 'NOTFOUND' }`. */
export const fetchLifiStatuses = async (swaps: { txHash: string; fromSymbol: string; toSymbol: string }[]): Promise<Record<string, string>> => {
  if (!swaps.length) return {};
  try {
    const d = await apiFetch<{ statuses?: Record<string, string> }>("/api/lifi/statuses", { body: { swaps } });
    return d?.statuses ?? {};
  } catch {
    return {};
  }
};
