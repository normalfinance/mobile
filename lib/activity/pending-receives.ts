// A payment the app has SEEN LAND (the Receive sheet's balance watcher, or
// the Bitcoin mempool watcher) before the chain's indexer carries it — shown
// in Activity as a pending "Received" row (Niko 2026-10-11: an ETH receive
// showed no pending state and the row arrived minutes later; Etherscan's
// index and our 300 s cache both lag). Mirror of lib/send/pending-sends.ts:
// dropped the moment a feed carries a matching Receive (same chain + symbol,
// amount within 2%, not older than the sighting), expired per chain as a
// backstop. Persisted; zero requests of its own.

import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { WalletChain } from "@/hooks/use-turnkey-wallet";

export interface PendingReceive {
  id: string;
  chain: WalletChain;
  symbol: string;
  amount: number;
  /** Chain txid when the watcher knows it (Bitcoin mempool); null for balance sightings. */
  txHash: string | null;
  seenAt: number;
}

const KEY = "pending_receives_v1";
const EXPIRY_MS: Record<WalletChain, number> = { stellar: 15 * 60_000, solana: 15 * 60_000, ethereum: 2 * 3_600_000, bitcoin: 48 * 3_600_000 };
const alive = (p: PendingReceive) => Date.now() - p.seenAt < (EXPIRY_MS[p.chain] ?? 3_600_000);

let cache: PendingReceive[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const persist = () => AsyncStorage.setItem(KEY, JSON.stringify(cache)).catch(() => undefined);
const load = async () => {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = (raw ? (JSON.parse(raw) as PendingReceive[]) : []).filter(alive);
    notify();
  } catch {
    cache = [];
  }
};

/** Record a sighting; a repeat of the same hash, or the same chain+symbol+amount within 10 min, is ignored. */
export const addPendingReceive = (p: Omit<PendingReceive, "id" | "seenAt">): void => {
  const dup = cache.some((x) => (p.txHash && x.txHash === p.txHash) || (x.chain === p.chain && x.symbol === p.symbol && Math.abs(x.amount - p.amount) <= Math.max(p.amount * 0.02, 1e-9) && Date.now() - x.seenAt < 10 * 60_000));
  if (dup) return;
  cache = [{ ...p, id: `pending-receive:${p.chain}:${p.txHash ?? Date.now()}`, seenAt: Date.now() }, ...cache];
  notify();
  void persist();
};

export interface SeenReceive {
  chain: WalletChain;
  symbol: string;
  amount: number;
  timestamp: number;
  txHash: string | null;
}

/** Drop sightings a feed now carries (hash match, or same chain+symbol, amount within 2%, dated after the sighting − 15 min) and expired ones. */
export const reconcilePendingReceives = (seen: SeenReceive[]): void => {
  const next = cache.filter((p) => {
    if (!alive(p)) return false;
    return !seen.some(
      (s) =>
        s.chain === p.chain &&
        ((p.txHash && s.txHash && s.txHash.toLowerCase() === p.txHash.toLowerCase()) ||
          (s.symbol === p.symbol && Math.abs(s.amount - p.amount) <= Math.max(p.amount * 0.02, 1e-9) && s.timestamp >= p.seenAt - 15 * 60_000))
    );
  });
  if (next.length !== cache.length) {
    cache = next;
    notify();
    void persist();
  }
};

export const usePendingReceives = (): PendingReceive[] => {
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
