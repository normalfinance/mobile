// What to refetch after the user's OWN Stellar action (send, savings deposit /
// withdraw, trustline) — a port of web's nf:activity-updated handlers:
//   hooks/use-wallet-balances.ts   portfolio with refresh=1, bounded retry on `floored`
//   lib/portfolio/refresh-retry.ts MAX_REFRESH_ATTEMPTS 3, nextReadDelayMs
//   lib/portfolio/client-cache.ts  pickNewerPayload, fillErroredFromKnown
//   hooks/stellar/use-user-activity.ts  activity/stellar?refresh=1, wallet/activity
//
// Why refresh=1: the portfolio route serves a 15s cache; a plain refetch right
// after an action returns the PRE-action balances (this is exactly what Niko
// saw 2026-09-15: withdraw → deposit → Home showed old wallet USDC next to new
// savings). refresh=1 bypasses it, floored 5s per user: a floored answer is
// the cache again and proves nothing, so it earns a retry after the server's
// retryAfterMs hint — a real read ends the loop.
//
// Savings position needs NO bypass here: execute-pair's confirm deletes both
// the position cache and its floor server-side (web server/tx-records.ts
// invalidateSavingsPositionCache), so hooks/use-savings.ts settle() reads fresh.

import type { QueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { accountProbeQueryKey } from "@/hooks/use-savings";
import { chainActivityQueryKey, walletActivityQueryKey } from "@/hooks/use-activity-feed";
import { portfolioQueryKey } from "@/hooks/use-backend-portfolio";
import type { PortfolioPayload } from "@/lib/types/portfolio.types";

const SETTLE_DELAY_MS = 800; // web: let the ledger close before the first read
const MAX_REFRESH_ATTEMPTS = 3;
const FLOOR_WAIT_MS = 5_600; // one full floor window + slack
const MIN_RETRY_WAIT_MS = 300;

type PortfolioRead = PortfolioPayload & { floored?: boolean; retryAfterMs?: number };

const nextReadDelayMs = (floored: boolean, retryAfterMs?: number): number => {
  if (!floored) return FLOOR_WAIT_MS;
  if (typeof retryAfterMs !== "number" || !Number.isFinite(retryAfterMs) || retryAfterMs <= 0) return FLOOR_WAIT_MS;
  return Math.min(Math.max(retryAfterMs, MIN_RETRY_WAIT_MS), FLOOR_WAIT_MS);
};

/** A stale straggler can never overwrite a fresher read (web pickNewerPayload). */
export const pickNewerPayload = <T extends PortfolioPayload>(current: T | undefined, incoming: T): T => {
  if (!current?.updatedAt) return incoming;
  if (!incoming.updatedAt) return current;
  return incoming.updatedAt >= current.updatedAt ? incoming : current;
};

/** A failed chain source (balance null) keeps the last KNOWN balance, marked
 *  stale — never flashes a real holding to 0 (web fillErroredFromKnown). */
export const fillErroredFromKnown = (incoming: PortfolioPayload, known: PortfolioPayload | undefined): PortfolioPayload => {
  if (!known?.assets?.length || !incoming.assets?.length) return incoming;
  const prior = new Map(known.assets.map((a) => [`${a.chain}:${a.symbol}`, a]));
  let patched = false;
  const assets = incoming.assets.map((a) => {
    if (a.balance !== null) return a;
    const p = prior.get(`${a.chain}:${a.symbol}`);
    if (!p || p.balance === null) return a;
    patched = true;
    return { ...p, status: "stale" as const, price: a.price ?? p.price };
  });
  return patched ? { ...incoming, assets } : incoming;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// One loop per user at a time: a burst of actions must not fan out into
// floored copies fighting over the same cache (web activityRefreshInFlight).
const inFlight = new Set<string>();

const refreshPortfolioFresh = async (queryClient: QueryClient, userId: string) => {
  const key = portfolioQueryKey(userId);
  if (inFlight.has(userId)) return;
  inFlight.add(userId);
  try {
    for (let attempt = 1; attempt <= MAX_REFRESH_ATTEMPTS; attempt += 1) {
      let got: PortfolioRead | null = null;
      try {
        got = await apiFetch<{ success: true } & PortfolioRead>("/api/wallet/portfolio", {
          query: { network: "mainnet", refresh: 1 }
        });
      } catch {
        /* transient — a failed read proves nothing; retry below */
      }
      if (got) {
        const { floored, retryAfterMs, ...payload } = got;
        queryClient.setQueryData<PortfolioPayload>(key, (current) => {
          const fresh = pickNewerPayload(current, payload as PortfolioPayload);
          return fillErroredFromKnown(fresh, current);
        });
        if (!floored) return; // a real read IS the answer
        if (attempt < MAX_REFRESH_ATTEMPTS) await sleep(nextReadDelayMs(true, retryAfterMs));
      } else if (attempt < MAX_REFRESH_ATTEMPTS) {
        await sleep(nextReadDelayMs(false));
      }
    }
  } finally {
    inFlight.delete(userId);
  }
};

const refreshStellarActivityFresh = async (queryClient: QueryClient, address: string) => {
  try {
    const data = await apiFetch("/api/activity/stellar", {
      anonymous: true,
      query: { address, refresh: 1 } // server floor 30s; a floored copy is still the latest cache
    });
    queryClient.setQueryData(chainActivityQueryKey("stellar", address), data);
  } catch {
    /* the next foreground refetch covers it */
  }
};

/**
 * Call once the action is CONFIRMED (hash returned / execute-pair 200).
 * Resolves when the portfolio has converged (or given up after 3 attempts)
 * and the first activity refresh landed — a "Done" screen may await it
 * (web gates Done on this, capped at 15s). The late +45s activity bypass
 * runs on after resolution. Every write goes through the rules above.
 */
export const refreshAfterStellarAction = (
  queryClient: QueryClient,
  { userId, stellarAddress }: { userId: string | undefined; stellarAddress: string | null | undefined }
): Promise<void> => {
  let resolveConverged: () => void = () => undefined;
  const converged = new Promise<void>((r) => {
    resolveConverged = r;
  });
  void (async () => {
    await sleep(SETTLE_DELAY_MS);
    await Promise.all([
      userId ? refreshPortfolioFresh(queryClient, userId) : Promise.resolve(),
      stellarAddress ? refreshStellarActivityFresh(queryClient, stellarAddress) : Promise.resolve(),
      // Our own DB rows (savings) are written before broadcast — a plain refetch is fresh.
      stellarAddress
        ? queryClient.invalidateQueries({ queryKey: walletActivityQueryKey(stellarAddress) })
        : Promise.resolve(),
      // XLM / trustline state for the setup card and fee light (Horizon, cheap).
      stellarAddress ? queryClient.invalidateQueries({ queryKey: accountProbeQueryKey(stellarAddress) }) : Promise.resolve()
    ]);
    resolveConverged();
    // Indexers lag (Horizon ~5s): one late bypass for the chain feed, past its
    // 30s floor. Portfolio converged above; position confirms on its own.
    if (stellarAddress) {
      await sleep(45_000);
      await refreshStellarActivityFresh(queryClient, stellarAddress);
    }
  })();
  return converged;
};
