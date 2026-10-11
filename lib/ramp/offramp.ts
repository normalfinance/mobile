// Sell crypto for cash via Coinbase Offramp — port of web offramp-dialog.tsx,
// coinbase-offramp-modal.tsx and offramp-resume-handler.tsx, per the contract
// confirmed by the web agent 2026-10-03 (docs/parity-audit.md §3 Sell).
//
//   1. POST /api/coinbase/session { address, asset, blockchain } → { token }
//   2. POST /api/ramp/transfers { direction:'offramp', … }  (tracking only)
//   3. open https://pay.coinbase.com/v3/sell/input?… (token is single-use)
//   4. back in the app: GET /api/offramp/fills + poll GET /api/coinbase/offramp-status
//      for the STARTED sell that matches (asset, currency, amount ≤ balance,
//      no txHash, no fill, created after the hand-off)
//   5. claim the fill (POST fills { providerTxnId }), send Coinbase's amount to
//      Coinbase's address with the passkey, record the hash (POST fills
//      { providerTxnId, txHash }); on send failure DELETE the claim
//   6. poll offramp-status until SUCCESS / FAILED / EXPIRED
//
// Web defects deliberately NOT copied: a re-send when a fill already has a
// hash (double-send), a 5-minute timeout shown as success, and offering an
// old abandoned STARTED order (we prefer orders created after the hand-off).

import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "@/lib/api";
import type { WalletChain } from "@/hooks/use-turnkey-wallet";
import type { BuyAsset } from "./coinbase";

export type SellAsset = BuyAsset;
export const SELL_RETURN_URL = "normalapp://sell";

/** Web lib/coinbase-offramp-rules.ts, verified live 2026-10-09 against
 *  GET /onramp/v1/sell/options: Coinbase sells BTC, ETH, SOL and USDC on
 *  Base/Ethereum/Solana — NO Stellar network at all, so XLM and USDC-on-Stellar
 *  can never complete (Coinbase cannot match the deposit). */
export const coinbaseCanSell = (chain: WalletChain, symbol: string): boolean =>
  chain === "stellar" ? false : chain === "bitcoin" ? symbol === "BTC" : chain === "ethereum" ? symbol === "ETH" || symbol === "USDC" : chain === "solana" ? symbol === "SOL" || symbol === "USDC" : false;

/** Coinbase gives 30 minutes from the order's creation to send the crypto (web). */
export const SELL_SEND_WINDOW_MS = 30 * 60_000;
export const sellDeadline = (createdAt: string | null | undefined): number | null => {
  const n = Date.parse(createdAt ?? "");
  return Number.isFinite(n) ? n + SELL_SEND_WINDOW_MS : null;
};

// Hand-off marker (web offramp-dialog): written when Coinbase opens, read by
// the matcher so only orders created for THIS hand-off are accepted; cleared
// on SUCCESS. Persisted so a killed app still matches the right order.
export interface SellHandoff {
  at: number;
  sym: SellAsset;
  chain: WalletChain;
  amount: number;
}
const HANDOFF_KEY = "sell_handoff_v1";
export const writeSellHandoff = (h: SellHandoff) => AsyncStorage.setItem(HANDOFF_KEY, JSON.stringify(h)).catch(() => undefined);
export const readSellHandoff = async (): Promise<SellHandoff | null> => {
  try {
    const raw = await AsyncStorage.getItem(HANDOFF_KEY);
    const h = raw ? (JSON.parse(raw) as SellHandoff) : null;
    // A marker older than a day is noise, not a hand-off.
    return h && Date.now() - h.at < 24 * 3_600_000 ? h : null;
  } catch {
    return null;
  }
};
export const clearSellHandoff = () => AsyncStorage.removeItem(HANDOFF_KEY).catch(() => undefined);

export const SELL_ASSETS: { asset: SellAsset; chain: WalletChain; label: string }[] = [
  { asset: "USDC", chain: "stellar", label: "USDC on Stellar" },
  { asset: "XLM", chain: "stellar", label: "Stellar Lumens" },
  { asset: "BTC", chain: "bitcoin", label: "Bitcoin" },
  { asset: "ETH", chain: "ethereum", label: "Ethereum" },
  { asset: "SOL", chain: "solana", label: "Solana" }
];

// --- reserves (web offramp-dialog.tsx) ---------------------------------------
/** Kept back from MAX on the amount step. XLM and BTC are live (see helpers). */
export const SELL_STATIC_RESERVE: Record<SellAsset, number> = { USDC: 0, SOL: 0.0009, ETH: 0.001, BTC: 0.0001, XLM: 1.6 };
/** Pre-flight before the send: amount + this ≤ spendable (web coinbase-offramp-modal.tsx). */
export const SELL_SEND_RESERVE: Record<"BTC" | "ETH" | "SOL", number> = { SOL: 0.0009, ETH: 0.001, BTC: 0.00002 };

/** BTC reserve = mempool halfHourFee (fallback 15) × 210 × 1.4 sats, clamped 0.00003–0.0005 BTC; 0.0001 on fetch failure. */
export const btcSellReserve = async (): Promise<number> => {
  try {
    const r = await fetch("https://mempool.space/api/v1/fees/recommended");
    const rate: number = r.ok ? (await r.json()).halfHourFee || 15 : 15;
    const btc = (rate * 210 * 1.4) / 1e8;
    return Math.min(Math.max(btc, 0.00003), 0.0005);
  } catch {
    return 0.0001;
  }
};
/** XLM reserve = (2 + subentries) × 0.5 + 0.01; 1.6 when Horizon can't be read. */
export const xlmSellReserve = (subentryCount: number | null): number => (subentryCount === null ? 1.6 : (2 + subentryCount) * 0.5 + 0.01);
export const sellMax = (balance: number, reserve: number): number => Math.max(Math.floor((balance - reserve) * 1e6) / 1e6, 0);

// --- Coinbase sell URL (web: pay.coinbase.com/v3/sell/input) -----------------
export const createCoinbaseSellURL = (o: { sessionToken: string; partnerUserRef: string; asset: SellAsset; chain: WalletChain; amount: number; fiat?: string; redirectUrl?: string }): string => {
  const params = new URLSearchParams({
    sessionToken: o.sessionToken,
    partnerUserRef: o.partnerUserRef,
    fiatCurrency: o.fiat ?? "USD",
    defaultNetwork: o.chain,
    defaultAsset: o.asset,
    presetCryptoAmount: o.amount.toFixed(6)
  });
  if (o.redirectUrl) params.set("redirectUrl", o.redirectUrl);
  return `https://pay.coinbase.com/v3/sell/input?${params.toString()}`;
};

/** Tracking row; never blocks the sale. amountExpected in CRYPTO units (web sent dollars — not copied).
 *  Returns the row id (the server reuses a still-active row for the same asset/wallet). */
export const recordOfframpHandoff = async (p: { asset: SellAsset; chain: WalletChain; walletAddress: string; amount: number; baselineBalance: number | null }): Promise<string | null> => {
  try {
    const d = await apiFetch<{ id?: string }>("/api/ramp/transfers", {
      body: {
        direction: "offramp",
        provider: "coinbase",
        network: "mainnet",
        asset: p.asset,
        chain: p.chain,
        walletAddress: p.walletAddress,
        amountExpected: String(p.amount),
        baselineBalance: p.baselineBalance != null ? String(p.baselineBalance) : null
      }
    });
    return d?.id ?? null;
  } catch {
    return null; /* cosmetic */
  }
};

/** Move the tracking row forward (web ramp/status.ts edges: committed →
 *  provider_complete once our on-chain send is out; → paid_out / failed from
 *  Coinbase's verdict). Web never settles offramp rows, so they linger as a
 *  second "Sell" until the 45-min abandon sweep — the feed also hides a row
 *  once the on-chain Sent row carries the sale. Best-effort. */
export const settleOfframpHandoff = async (id: string | null, status: "provider_complete" | "paid_out" | "failed"): Promise<void> => {
  if (!id) return;
  try {
    if (status !== "provider_complete") await apiFetch(`/api/ramp/transfers/${encodeURIComponent(id)}`, { method: "PATCH", body: { status: "provider_complete" } }).catch(() => undefined);
    await apiFetch(`/api/ramp/transfers/${encodeURIComponent(id)}`, { method: "PATCH", body: { status } });
  } catch {
    /* cosmetic */
  }
};

// --- Coinbase order status + fills ---------------------------------------------
export type OfframpStatus = "TRANSACTION_STATUS_STARTED" | "TRANSACTION_STATUS_SUCCESS" | "TRANSACTION_STATUS_FAILED" | "TRANSACTION_STATUS_EXPIRED" | string;
export interface OfframpTx {
  transactionId: string | null;
  status: OfframpStatus | null;
  toAddress: string | null;
  fromAddress: string | null;
  asset: string | null;
  network: string | null;
  amount: string | null;
  currency: string | null;
  txHash: string | null;
  createdAt: string | null;
  /** Server-normalised (memo / deposit_memo / destination_tag / to_memo / to_address_memo); may arrive as a number. */
  memo: string | number | null;
}
export interface OfframpFill {
  providerTxnId: string;
  txHash: string | null;
}

export const fetchOfframpStatus = async (): Promise<OfframpTx[]> => {
  const d = await apiFetch<{ transactions?: OfframpTx[] }>("/api/coinbase/offramp-status");
  return d?.transactions ?? [];
};
export const fetchFills = async (): Promise<OfframpFill[]> => {
  try {
    const d = await apiFetch<{ fills?: OfframpFill[] }>("/api/offramp/fills");
    return d?.fills ?? [];
  } catch {
    return [];
  }
};
export const claimFill = (providerTxnId: string) => apiFetch("/api/offramp/fills", { body: { providerTxnId } });
export const recordFill = (providerTxnId: string, txHash: string) => apiFetch("/api/offramp/fills", { body: { providerTxnId, txHash } });
export const releaseFill = (providerTxnId: string) => apiFetch("/api/offramp/fills", { method: "DELETE", body: { providerTxnId } }).catch(() => undefined);

/**
 * The sell to fulfil (web coinbase-offramp-modal, hardened 2026-10-09):
 * STARTED, toAddress + amount present, asset and currency = symbol, no fill.
 * With a hand-off marker: ONLY orders created at or after marker − 2 min
 * (clock skew); undated orders are rejected. Without a marker: fall back to
 * balance/age filters. A STARTED order we already sent for → confirming.
 */
export const pickPendingSell = (txs: OfframpTx[], fills: OfframpFill[], o: { asset: SellAsset; balance: number; since: number | null; handedOff?: number | null }): { tx: OfframpTx; alreadyFilled: boolean } | null => {
  const filled = new Map(fills.map((f) => [f.providerTxnId, f.txHash]));
  // createdAt is Coinbase's created_at passed through: probably RFC 3339, possibly
  // null — never exclude a row on time alone (web agent 2026-10-03).
  const ts = (t: OfframpTx) => {
    const n = Date.parse(t.createdAt ?? "");
    return Number.isFinite(n) ? n : 0;
  };
  const started = txs
    .filter((t) => t.status === "TRANSACTION_STATUS_STARTED" && !!t.transactionId && !!t.toAddress && !!t.amount && t.asset === o.asset && t.currency === o.asset)
    .sort((a, b) => ts(b) - ts(a));
  // A STARTED order we already sent for → go straight to confirming.
  const sentAlready = started.find((t) => t.transactionId && filled.get(t.transactionId));
  if (sentAlready) return { tx: sentAlready, alreadyFilled: true };
  const open = started.filter((t) => !t.txHash && !filled.has(t.transactionId!));
  if (!open.length) return null;
  if (o.since) {
    // Marker present: strictly the orders this hand-off produced.
    const fresh = open.filter((t) => ts(t) > 0 && ts(t) >= o.since! - 120_000);
    const sameAmount = o.handedOff ? fresh.filter((t) => Math.abs((parseFloat(t.amount ?? "0") || 0) - o.handedOff!) < 1e-6) : [];
    return fresh.length ? { tx: sameAmount[0] ?? fresh[0], alreadyFilled: false } : null;
  }
  // No marker (resume from Activity): balance filter, newest first.
  const affordable = open.filter((t) => (parseFloat(t.amount ?? "0") || 0) <= o.balance + 1e-9);
  return affordable.length ? { tx: affordable[0], alreadyFilled: false } : null;
};

export const terminalLabel = (status: string | null | undefined): "success" | "failed" | null =>
  status === "TRANSACTION_STATUS_SUCCESS" ? "success" : status === "TRANSACTION_STATUS_FAILED" || status === "TRANSACTION_STATUS_EXPIRED" ? "failed" : null;
