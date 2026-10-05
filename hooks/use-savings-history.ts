// #53 (web hooks/use-savings-history.ts): the wallet's REAL deposit/withdraw
// history for the earnings chart.
//   GET /api/savings/earnings-history?user=&network=mainnet   public,
//   { success, events: [{ type, amount, timestamp }] }, server cache 600s.
// Disk seed for an instant paint; errors keep the last curve (a failed fetch
// must never flatten a chart to $0).

import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { SavingsHistoryEvent } from "@/lib/savings/earnings-history";

const LS_KEY = "savings_history_v1";
export const savingsHistoryQueryKey = (address: string | null | undefined) => ["savings", "history", address ?? "none"] as const;

const readCache = async (address: string): Promise<SavingsHistoryEvent[] | null> => {
  try {
    const raw = await AsyncStorage.getItem(`${LS_KEY}:${address}`);
    return raw ? (JSON.parse(raw) as SavingsHistoryEvent[]) : null;
  } catch {
    return null;
  }
};

export const fetchSavingsHistory = async (address: string): Promise<SavingsHistoryEvent[]> => {
  const json = await apiFetch<{ success: boolean; events?: SavingsHistoryEvent[]; error?: string }>("/api/savings/earnings-history", {
    anonymous: true,
    query: { user: address, network: "mainnet" }
  });
  if (!json.success || !Array.isArray(json.events)) throw new Error(json.error ?? "history unavailable");
  AsyncStorage.setItem(`${LS_KEY}:${address}`, JSON.stringify(json.events)).catch(() => undefined);
  return json.events;
};

export const useSavingsHistory = (address: string | null | undefined) => {
  const queryClient = useQueryClient();
  const key = savingsHistoryQueryKey(address);
  const query = useQuery({
    queryKey: key,
    enabled: !!address,
    queryFn: () => fetchSavingsHistory(address!),
    // The server caches 10 min and the curve only changes on our own
    // deposit/withdraw (after-action invalidates it). No timers.
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData,
    retry: 3
  });
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
  return { events: query.data ?? [], isLoading: query.isLoading && !query.data, error: query.error, refetch: query.refetch };
};
