// Port of web lib/spendable.ts (#62): spendable balance = displayed balance −
// pending outflows. Send SOL → the balance display lags a few seconds → a
// MAX swap would offer money that already left; the chain rejects it and the
// user sees a confusing failure.
//
// Deliberately NOT an optimistic write into any balance store (that pattern
// caused the stuck-balance findings #52/#55). A pure, derived adjustment
// recomputed from ledgers that already exist:
//   - pending-send rows (lib/send/pending-sends.ts — AsyncStorage),
//   - in-flight swap source amounts (registered by the runner on start,
//     cleared when the run settles).
// When a pending row clears (feed reconcile / expiry) or a swap settles, the
// adjustment vanishes by itself — nothing stored, nothing to clobber.

import React from "react";

import type { WalletChain } from "@/hooks/use-turnkey-wallet";
import { getPendingSends, subscribePendingSends } from "@/lib/send/pending-sends";

interface SwapOutflow {
  chain: WalletChain;
  symbol: string;
  /** Display units, e.g. "0.05" ETH. */
  amount: string;
}

const swapOutflows = new Map<string, SwapOutflow>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Called by the swap runner when a run starts moving source funds. */
export const registerSwapOutflow = (key: string, outflow: SwapOutflow): void => {
  swapOutflows.set(key, outflow);
  notify();
};
/** Called when the run settles (done / error / calm / cancelled). Safe twice. */
export const clearSwapOutflow = (key: string): void => {
  if (swapOutflows.delete(key)) notify();
};

/** Sum of in-flight outflows for a chain+symbol (display units). */
export const pendingOutflowAmount = (chain: WalletChain | undefined, symbol: string | undefined): number => {
  if (!chain || !symbol) return 0;
  let sum = 0;
  for (const send of getPendingSends()) {
    if (send.chain === chain && send.symbol === symbol) {
      const n = parseFloat(send.amount);
      if (Number.isFinite(n) && n > 0) sum += n;
    }
  }
  for (const flow of swapOutflows.values()) {
    if (flow.chain === chain && flow.symbol === symbol) {
      const n = parseFloat(flow.amount);
      if (Number.isFinite(n) && n > 0) sum += n;
    }
  }
  return sum;
};

/** Reactive pending-outflow total; MAX buttons recompute the moment a send
 *  is broadcast or settles. */
export const usePendingOutflow = (chain: WalletChain | undefined, symbol: string | undefined): number => {
  const subscribe = React.useCallback((onChange: () => void) => {
    const unsub = subscribePendingSends(onChange);
    listeners.add(onChange);
    return () => {
      unsub();
      listeners.delete(onChange);
    };
  }, []);
  // Snapshot must be the value itself (React Compiler + useSyncExternalStore).
  return React.useSyncExternalStore(
    subscribe,
    () => pendingOutflowAmount(chain, symbol),
    () => 0
  );
};
