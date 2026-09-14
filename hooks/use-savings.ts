// Normal Savings = the DeFindex vault over Blend on Stellar.
//   GET /api/savings/vault-info      public — APY, asset, vault address
//   GET /api/savings/user-position   public — the user's position (slow: Soroban
//                                    RPC can take 15–25s cold; 30s server cache)
// Deposit / withdraw live in lib/savings/engine.ts; this file owns the reads,
// their caches, and the post-action "optimistic then confirm" dance.

import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import {
  fetchSavingsPosition,
  probeStellarAccount,
  reconcileSavingsPosition,
  type SavingsPosition,
  type StellarAccountProbe
} from "@/lib/savings/engine";

export interface VaultInfo {
  address: string;
  name: string;
  symbol: string;
  totalDeposits: string;
  apy: number; // percent, e.g. 6.82
  asset: string; // "USDC"
  fees?: { vaultFee: number; defindexFee: number };
}

interface VaultInfoResponse {
  success: true;
  vault: VaultInfo;
}

export const vaultInfoQueryKey = ["savings", "vault-info"] as const;

export const useVaultInfo = () =>
  useQuery({
    queryKey: vaultInfoQueryKey,
    queryFn: async () => {
      const data = await apiFetch<VaultInfoResponse>("/api/savings/vault-info", {
        anonymous: true,
        query: { network: "mainnet" }
      });
      return data.vault;
    },
    // Vault facts barely move; server caches 120s with a 1h stale copy and
    // there is no refresh param. Once per app launch is enough — DeFindex's
    // per-second limit must never see a timer from a phone.
    staleTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1
  });

// ---------------------------------------------------------------------------
// Position
// ---------------------------------------------------------------------------

export const savingsPositionQueryKey = (address: string | null | undefined) =>
  ["savings", "position", address ?? "none"] as const;

// Last-known position per address, 24h stale-while-revalidate (web
// nf_savings_position_cache_v2): a cold app paints the last real number and
// confirms in the background instead of showing a confident $0 for 20s.
const CACHE_KEY = "savings_position_cache_v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const readCache = async (address: string): Promise<SavingsPosition | null> => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, { position: SavingsPosition; cachedAt: number }>) : {};
    const entry = all[address];
    if (!entry || Date.now() - entry.cachedAt > CACHE_TTL_MS) return null;
    return entry.position;
  } catch {
    return null;
  }
};

const writeCache = async (address: string, position: SavingsPosition) => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    all[address] = { position, cachedAt: Date.now() };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    /* storage full — non-fatal */
  }
};

// #52 epoch guard: a read that started before the latest deposit/withdraw
// describes a world that no longer exists and must be discarded before it can
// overwrite the optimistic figure.
const epochs = new Map<string, number>();
const epochOf = (address: string) => epochs.get(address) ?? 0;
export const bumpSavingsEpoch = (address: string) => epochs.set(address, epochOf(address) + 1);

class StaleSavingsRead extends Error {
  constructor() {
    super("Savings read started before the latest action — discarded");
    this.name = "StaleSavingsRead";
  }
}

export const useSavingsPosition = (address: string | null | undefined) => {
  const queryClient = useQueryClient();
  const key = savingsPositionQueryKey(address);

  const query = useQuery({
    queryKey: key,
    enabled: !!address,
    queryFn: async () => {
      const addr = address!;
      const epochAtStart = epochOf(addr);
      const prev = queryClient.getQueryData<SavingsPosition>(key) ?? (await readCache(addr));
      const api = await fetchSavingsPosition(addr);
      if (epochAtStart !== epochOf(addr)) throw new StaleSavingsRead();
      if (api == null && !prev) {
        // Upstream failed and there is nothing to fall back on → keep loading.
        throw new Error("Position unavailable — upstream read failed and no cached value");
      }
      const result = reconcileSavingsPosition(api, prev);
      void writeCache(addr, result);
      return result;
    },
    placeholderData: keepPreviousData,
    // Never on a timer (DeFindex per-second limit; a cold read is a 15–25s
    // Soroban call). Foreground refetch only fires once the value is >30s old.
    staleTime: 30_000,
    retry: 3
  });

  // Seed from disk on a cold start so the first paint is the last real number.
  React.useEffect(() => {
    if (!address) return;
    let cancelled = false;
    void readCache(address).then((cached) => {
      if (cancelled || !cached) return;
      if (queryClient.getQueryData(key) === undefined) queryClient.setQueryData(key, cached);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  /** After a deposit/withdraw: show the optimistic number now, then confirm
   *  at 3s / 15s / 45s with PLAIN reads — the server deletes the position
   *  cache and its refresh floor on a confirmed action, so the next read is
   *  live by construction; refresh=1 would only re-arm a 30s floor. */
  const settle = React.useCallback(
    (next: SavingsPosition) => {
      if (!address) return;
      bumpSavingsEpoch(address);
      queryClient.setQueryData(key, next);
      void writeCache(address, next);
      const confirm = async () => {
        try {
          const api = await fetchSavingsPosition(address);
          const prev = queryClient.getQueryData<SavingsPosition>(key) ?? null;
          if (api) {
            const merged = reconcileSavingsPosition(api, prev);
            queryClient.setQueryData(key, merged);
            void writeCache(address, merged);
          }
        } catch {
          /* the optimistic value stands; the next regular read confirms */
        }
      };
      [3_000, 15_000, 45_000].forEach((ms) => setTimeout(() => void confirm(), ms));
    },
    [address, key, queryClient]
  );

  const position = query.data ?? null;
  const value = Math.max(parseFloat(position?.currentValue || "0"), 0);
  const earnings = parseFloat(position?.earnings || "0");

  return {
    position,
    value,
    earnings,
    hasActiveSavings: value > 0,
    isLoading: query.isLoading && !position,
    isError: query.isError && !position,
    refetch: query.refetch,
    settle
  };
};

// ---------------------------------------------------------------------------
// Account probe (setup steps + XLM fee light)
// ---------------------------------------------------------------------------

export const accountProbeQueryKey = (address: string | null | undefined) =>
  ["stellar", "account-probe", address ?? "none"] as const;

/** Polls Horizon (the one cheap upstream) while `watch` is true — setup
 *  incomplete or the fee light not green — so activation and top-ups are
 *  detected without a manual refresh. Callers pass `watch` only while their
 *  screen is actually focused; TanStack already pauses intervals in the
 *  background (`refetchIntervalInBackground` is false). */
export const useStellarAccountProbe = (address: string | null | undefined, watch: boolean) =>
  useQuery<StellarAccountProbe>({
    queryKey: accountProbeQueryKey(address),
    enabled: !!address,
    queryFn: () => probeStellarAccount(address!),
    staleTime: 10_000,
    refetchInterval: watch ? 4_000 : false,
    retry: 1
  });
