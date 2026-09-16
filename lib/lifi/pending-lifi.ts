// On-disk ledger of LI.FI native ⇄ native swaps this phone broadcast and has
// not yet seen settle. Closes the hole web has too: the swap's ONLY activity
// row (lifi/record) is written after the source tx confirms, so an app killed
// in that window would never record it. On the next launch every entry is
// restored as a live run (In flight + run page) and tracked to the end;
// `recorded` guards against a second record. Entries expire after 48h.

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { CrosschainSymbol } from "@/lib/cctp/config";
import type { LifiTrackedTx } from "./tracker";

export interface PendingLifi extends LifiTrackedTx {
  fromSymbol: CrosschainSymbol;
  toSymbol: CrosschainSymbol;
  /** For rebuilding the run's header/details after a restart. */
  toAmountMin: string;
  feePercent: number;
  etaMin: number | null;
  tool: string | null;
  recorded: boolean;
  createdAt: number;
}

const KEY = "pending_lifi_v1";
const TTL_MS = 48 * 60 * 60 * 1000;

let cache: PendingLifi[] = [];
let loaded = false;

const persist = () => AsyncStorage.setItem(KEY, JSON.stringify(cache)).catch(() => undefined);

export const loadPendingLifi = async (): Promise<PendingLifi[]> => {
  if (!loaded) {
    loaded = true;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      cache = raw ? (JSON.parse(raw) as PendingLifi[]) : [];
      cache = cache.filter((p) => Date.now() - p.createdAt < TTL_MS);
    } catch {
      cache = [];
    }
  }
  return cache;
};

export const addPendingLifi = (entry: Omit<PendingLifi, "createdAt" | "recorded">) => {
  cache = [{ ...entry, recorded: false, createdAt: Date.now() }, ...cache.filter((p) => p.txHash !== entry.txHash)];
  void persist();
};

export const markLifiRecorded = (txHash: string) => {
  cache = cache.map((p) => (p.txHash === txHash ? { ...p, recorded: true } : p));
  void persist();
};

export const removePendingLifi = (txHash: string) => {
  cache = cache.filter((p) => p.txHash !== txHash);
  void persist();
};
