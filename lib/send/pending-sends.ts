// A just-broadcast send, visible in Activity before the chain's indexer has
// it (web lib/pending-sends.ts). The row is dropped the moment any feed
// carries its hash, and expires per chain regardless (web EXPIRY_MS: the
// backstop for a feed outage, not the normal path — Bitcoin's window matches
// how long a low-fee tx can sit unconfirmed; Ethereum's covers Etherscan
// indexing lag). Persisted so a killed app still shows what it just sent.
// Zero requests of its own.

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
const EXPIRY_MS: Record<WalletChain, number> = {
  stellar: 10 * 60_000,
  solana: 10 * 60_000,
  ethereum: 2 * 3_600_000,
  bitcoin: 48 * 3_600_000
};
const alive = (p: PendingSend) => Date.now() - p.createdAt < (EXPIRY_MS[p.chain] ?? 3_600_000);

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
    cache = cache.filter(alive);
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
  const next = cache.filter((p) => !knownHashes.has(p.txHash.toLowerCase()) && alive(p));
  if (next.length !== cache.length) {
    cache = next;
    notify();
    void persist();
    if (confirmed.length) settledListeners.forEach((l) => l(confirmed));
  }
};

/** Current ledger (lib/spendable.ts); loads from disk on first use. */
export const getPendingSends = (): PendingSend[] => {
  void load();
  return cache;
};
export const subscribePendingSends = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
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
