// MoneyGram cash deposit (SEP-10 + SEP-24), ported from web lib/mgi/{client,
// history, db, statuses}.ts and Q42:
//   GET  mgi/info                              public — live USDC limits
//   GET  mgi/sep10/challenge?account=          → { transaction, network_passphrase }
//   POST mgi/sep10/complete { userSignedXDR }  → { token }   (server co-signs)
//   POST mgi/sep24/deposit { token, account, amount } → { url, id }  (DB row 'incomplete')
//   GET  mgi/sep24/transactions/proxy/[id]     header x-mgi-token → { transaction }
//   POST mgi/sep24/transactions/moreinfo { token, id } → { more_info_url }
//   GET  mgi/transactions                      our DB rows (no SEP-10)
//   PATCH mgi/transactions/[id] { status?, externalTransactionId? }
// The SEP-10 token is one passkey prompt, cached per account until its JWT
// exp (15 min fallback) — history and the banner render from OUR rows and
// never trigger a ceremony. Web learns "committed" by postMessage; the app
// polls the proxy while MoneyGram's page is open (Q42 plan).

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Networks } from "@stellar/stellar-sdk";
import * as WebBrowser from "expo-web-browser";

import { ApiError, apiFetch } from "@/lib/api";
import { signStellarXdr } from "@/lib/stellar/signer";

// ─── Statuses (web lib/mgi/statuses.ts, verbatim) ────────────────────────────

export interface MgiDbTransaction {
  id: string;
  walletAddress: string;
  kind: "deposit" | "withdrawal";
  status: string;
  amount: string | null;
  externalTransactionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Sep24Transaction {
  id: string;
  kind: "deposit" | "withdrawal";
  status: string;
  amount_in?: { amount: string; asset: string };
  amount_out?: { amount: string; asset: string };
  external_transaction_id?: string;
  more_info_url?: string;
  message?: string;
}

/** In flight — the user (or MoneyGram) still has something to do. */
export const PENDING_MGI_STATUSES = new Set(["pending_user_transfer_start", "pending_user_transfer_complete", "pending_anchor", "pending_stellar", "pending_external"]);
/** Terminal and unsuccessful. */
export const FAILED_MGI_STATUSES = new Set(["error", "expired", "no_market", "too_small", "too_large"]);
/** Nothing will change anymore — stop polling these. */
export const TERMINAL_MGI_STATUSES = new Set(["completed", "refunded", ...FAILED_MGI_STATUSES]);

export const mgiStatusLabel = (status: string): string => {
  if (status === "completed") return "Completed";
  if (status === "refunded") return "Refunded";
  if (status === "incomplete") return "Not started";
  if (PENDING_MGI_STATUSES.has(status)) return status === "pending_user_transfer_start" ? "Awaiting cash drop-off" : "Processing";
  if (FAILED_MGI_STATUSES.has(status)) return status === "expired" ? "Expired" : "Failed";
  return status.replace(/_/g, " ");
};

// ─── Limits ──────────────────────────────────────────────────────────────────

export interface MgiLimits {
  deposit: { min: number; max: number };
  withdraw: { min: number; max: number };
}
/** Last-verified live values (web 2026-07-23) until mgi/info answers. */
export const MGI_FALLBACK_LIMITS: MgiLimits = { deposit: { min: 15, max: 950 }, withdraw: { min: 15, max: 2500 } };

export const fetchMgiLimits = async (): Promise<MgiLimits> => {
  const d = await apiFetch<Partial<MgiLimits>>("/api/mgi/info", { anonymous: true });
  return {
    deposit: { min: Number(d.deposit?.min) || 15, max: Number(d.deposit?.max) || 950 },
    withdraw: { min: Number(d.withdraw?.min) || 15, max: Number(d.withdraw?.max) || 2500 }
  };
};

// ─── SEP-10 token cache (web mgiAuth.v2) ─────────────────────────────────────

const TOKEN_KEY = (account: string) => `mgi_auth_v2:${account}`;

const jwtExpMs = (token: string): number | undefined => {
  try {
    const [, payload] = token.split(".");
    if (!payload) return undefined;
    const json = JSON.parse(globalThis.atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return typeof json.exp === "number" ? json.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
};

const readToken = async (account: string): Promise<string | null> => {
  try {
    const raw = await AsyncStorage.getItem(TOKEN_KEY(account));
    const v = raw ? (JSON.parse(raw) as { token: string; exp: number }) : null;
    // 30 s of slack: a token that expires mid-poll is worse than a fresh one.
    return v && Date.now() + 30_000 < v.exp ? v.token : null;
  } catch {
    return null;
  }
};
const writeToken = (account: string, token: string) =>
  AsyncStorage.setItem(TOKEN_KEY(account), JSON.stringify({ token, exp: jwtExpMs(token) ?? Date.now() + 15 * 60_000 })).catch(() => undefined);
export const clearMgiToken = (account: string) => AsyncStorage.removeItem(TOKEN_KEY(account)).catch(() => undefined);
/** True when the next MoneyGram call needs no passkey prompt. */
export const hasCachedMgiToken = async (account: string) => !!(await readToken(account));

/** SEP-10 sign-in: one passkey prompt unless a token is cached. */
export const getMgiAuthToken = async (account: string, subOrgId: string): Promise<string> => {
  const cached = await readToken(account);
  if (cached) return cached;
  const ch = await apiFetch<{ transaction: string; network_passphrase?: string }>("/api/mgi/sep10/challenge", { query: { account } });
  const signed = await signStellarXdr({ xdr: ch.transaction, subOrgId, stellarAddress: account, networkPassphrase: ch.network_passphrase || Networks.PUBLIC });
  const res = await apiFetch<{ token?: string; access_token?: string }>("/api/mgi/sep10/complete", { body: { userSignedXDR: signed } });
  const token = res.token ?? res.access_token;
  if (!token) throw new Error("MoneyGram sign-in returned no token.");
  await writeToken(account, token);
  return token;
};

// ─── Deposit ─────────────────────────────────────────────────────────────────

export const startMgiDeposit = async (token: string, account: string, amount: number): Promise<{ url: string; id: string | null }> => {
  const d = await apiFetch<{ url?: string; id?: string | null }>("/api/mgi/sep24/deposit", { body: { token, account, amount } });
  if (!d.url) throw new Error("MoneyGram is temporarily unavailable — please try again.");
  return { url: d.url, id: d.id ?? null };
};

/** One SEP-24 transaction straight from MoneyGram (via our proxy). */
export const getMgiTransaction = async (account: string, id: string, token: string): Promise<Sep24Transaction> => {
  try {
    const d = await apiFetch<{ transaction: Sep24Transaction }>(`/api/mgi/sep24/transactions/proxy/${encodeURIComponent(id)}`, { headers: { "x-mgi-token": token } });
    return d.transaction;
  } catch (e) {
    // Expired SEP-10 token: drop it so the NEXT attempt re-authenticates
    // instead of failing every poll forever (web doc 90 W2).
    if (e instanceof ApiError && e.status === 401) await clearMgiToken(account);
    throw e;
  }
};

/** Mirror a fresh MoneyGram status into our DB row — best-effort. */
export const reportMgiStatus = async (id: string, patch: { status?: string; externalTransactionId?: string }) => {
  try {
    await apiFetch(`/api/mgi/transactions/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
  } catch {
    /* best-effort mirror */
  }
};

/** Fresh state from MoneyGram, mirrored into our row. May prompt a passkey
 *  when no token is cached — call from explicit user actions only. */
export const refreshMgiStatus = async (account: string, subOrgId: string, id: string): Promise<Sep24Transaction> => {
  const token = await getMgiAuthToken(account, subOrgId);
  const tx = await getMgiTransaction(account, id, token);
  const status = tx.status ? String(tx.status) : undefined;
  const externalTransactionId = tx.external_transaction_id ? String(tx.external_transaction_id) : undefined;
  if (status || externalTransactionId) await reportMgiStatus(id, { status, externalTransactionId });
  return tx;
};

export const fetchMgiTransactions = async (): Promise<MgiDbTransaction[]> => {
  const d = await apiFetch<{ transactions?: MgiDbTransaction[] }>("/api/mgi/transactions");
  return d.transactions ?? [];
};

/** MoneyGram's own transaction page (reference, receipt, cancel/refund live there). */
export const openMgiDetails = async (account: string, subOrgId: string, id: string): Promise<void> => {
  const token = await getMgiAuthToken(account, subOrgId);
  const d = await apiFetch<{ more_info_url?: string }>("/api/mgi/sep24/transactions/moreinfo", { body: { token, id } });
  if (!d.more_info_url) throw new Error("MoneyGram is temporarily unavailable — please try again.");
  await WebBrowser.openBrowserAsync(d.more_info_url);
};

/**
 * Watch a just-started deposit while MoneyGram's page is open: every 4 s
 * (web ×45) until the user commits (status leaves 'incomplete'); mirrors the
 * status + reference into our row and resolves with the first committed state.
 */
export const watchMgiCommit = async (
  account: string,
  id: string,
  token: string,
  opts: { until: () => boolean; onStatus?: (tx: Sep24Transaction) => void; maxTries?: number }
): Promise<Sep24Transaction | null> => {
  const max = opts.maxTries ?? 45;
  for (let i = 0; i < max && !opts.until(); i++) {
    await new Promise((r) => setTimeout(r, 4000));
    try {
      const tx = await getMgiTransaction(account, id, token);
      opts.onStatus?.(tx);
      if (tx.status && tx.status !== "incomplete") {
        await reportMgiStatus(id, { status: tx.status, externalTransactionId: tx.external_transaction_id || undefined });
        return tx;
      }
    } catch {
      /* transient — next tick */
    }
  }
  return null;
};
