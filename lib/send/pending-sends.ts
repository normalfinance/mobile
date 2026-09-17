// A just-broadcast send, visible in Activity before the chain's indexer has
// it (web lib/pending-sends.ts). The row is dropped the moment any feed
// carries its hash, and expires after 24h regardless. Persisted so a killed
// app still shows what it just sent. Zero requests of its own.

import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { WalletChain } from "@/hooks/use-turnkey-wallet";

export interface PendingSend {
  chain: WalletChain;
  txHash: string;
  symbol: string;
  amount: string;
  destination: string;
  createdAt: number;
}

const KEY = "pending_sends_v1";
const TTL_MS = 24 * 60 * 60 * 1000;

let cache: PendingSend[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const persist = () => AsyncStorage.setItem(KEY, JSON.stringify(cache)).catch(() => undefined);

const load = async () => {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as PendingSend[]) : [];
    cache = cache.filter((p) => Date.now() - p.createdAt < TTL_MS);
    notify();
  } catch {
    cache = [];
  }
};

export const addPendingSend = (entry: Omit<PendingSend, "createdAt">) => {
  cache = [{ ...entry, createdAt: Date.now() }, ...cache.filter((p) => p.txHash !== entry.txHash)];
  notify();
  void persist();
};

const settledListeners = new Set<(sends: PendingSend[]) => void>();
/** Fires with the sends a feed has just confirmed (notifications). */
export const onSendsSettled = (l: (sends: PendingSend[]) => void) => {
  settledListeners.add(l);
  return () => settledListeners.delete(l);
};

/** Drop entries a feed now carries (case-insensitive hash match) or that expired. */
export const reconcilePendingSends = (knownHashes: ReadonlySet<string>) => {
  const confirmed = cache.filter((p) => knownHashes.has(p.txHash.toLowerCase()));
  const next = cache.filter((p) => !knownHashes.has(p.txHash.toLowerCase()) && Date.now() - p.createdAt < TTL_MS);
  if (next.length !== cache.length) {
    cache = next;
    notify();
    void persist();
    if (confirmed.length) settledListeners.forEach((l) => l(confirmed));
  }
};

export const usePendingSends = (): PendingSend[] => {
  React.useEffect(() => {
    void load();
  }, []);
  return React.useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => cache,
    () => cache
  );
};
