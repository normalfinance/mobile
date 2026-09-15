// The swap RUN lives outside any screen (web doc 93 0c, agreed with Niko
// 2026-08-27: "every swap runs on a PAGE, not a popup" — all steps shown up
// front, an explicit Start button, and a run that survives navigation). The
// card hands a spec to this store, app/swap-run.tsx starts it and renders
// progress from here; the In-flight card reopens a run by its transfer id.

import React from "react";

import type { CrosschainSymbol } from "@/lib/cctp/config";
import type { LifiQuote } from "@/lib/lifi/execute";
import type { SwapQuote } from "@/lib/swap/soroswap";
import type { StellarSymbol } from "@/lib/swap/registry";

export type RunSpec =
  | { kind: "soroswap"; from: StellarSymbol; to: StellarSymbol; quote: SwapQuote; amount: string }
  | { kind: "cctp-out"; from: "USDC"; to: CrosschainSymbol; amount: string; feePercent: number; lifiTool: string | null; toAddress: string; etaMin: number | null; toAmount: number }
  | { kind: "cctp-in"; from: CrosschainSymbol; to: "USDC"; amount: string; quote: LifiQuote; feePercent: number; etaMin: number | null; usdcOut: number }
  /** LI.FI native ⇄ native (BTC / ETH / SOL), delivered to the user's own address. */
  | { kind: "lifi"; from: CrosschainSymbol; to: CrosschainSymbol; amount: string; quote: LifiQuote; feePercent: number; etaMin: number | null; toAmount: number; tool: string | null };

export interface RunNotice {
  text: string;
  tone: "amber" | "blue";
  affordable?: string;
}

export interface RunState {
  id: string; // local id; equals transferId once known for CCTP
  spec: RunSpec;
  status: "idle" | "running" | "done" | "error" | "calm";
  stage: string | null;
  /** Soroswap: one or two signatures; CCTP: autopilot on for this run. */
  flags: { embedded?: boolean; degradedAfterSign?: boolean; autopilot?: boolean; priceMoved?: boolean };
  transferId?: string;
  result?: { hash: string; verdict?: string | null; dstAmount?: string };
  /** LI.FI: the source tx hash the moment it is broadcast (for explorer / In flight). */
  sourceTxHash?: string;
  notice?: RunNotice;
  /** true once money reached a chain — recovery is via In flight, not "try again". */
  broadcastStarted: boolean;
  startedAt: number;
}

let pending: RunSpec | null = null;
const runs = new Map<string, RunState>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const setPendingRun = (spec: RunSpec): string => {
  pending = spec;
  const id = `run-${Date.now()}`;
  runs.set(id, { id, spec, status: "idle", stage: null, flags: {}, broadcastStarted: false, startedAt: Date.now() });
  notify();
  return id;
};

export const getRun = (id: string): RunState | undefined => runs.get(id);
export const runByTransfer = (transferId: string): RunState | undefined => [...runs.values()].find((r) => r.transferId === transferId);

export const updateRun = (id: string, patch: Partial<RunState> | ((r: RunState) => Partial<RunState>)): void => {
  const cur = runs.get(id);
  if (!cur) return;
  const p = typeof patch === "function" ? patch(cur) : patch;
  runs.set(id, { ...cur, ...p, flags: { ...cur.flags, ...(p.flags ?? {}) } });
  notify();
};

export const clearPendingRun = () => {
  pending = null;
};
export const getPendingRun = () => pending;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

// The snapshot IS the run object (a fresh object per update, see updateRun).
// Reading `runs.get(id)` outside the snapshot broke under the React Compiler:
// it memoised the lookup on `id` alone, so the page kept rendering the idle
// run after Start (Niko 2026-09-16: "the steps did not start").
export const useRun = (id: string | undefined): RunState | undefined =>
  React.useSyncExternalStore(
    subscribe,
    () => (id ? runs.get(id) : undefined),
    () => (id ? runs.get(id) : undefined)
  );

/** Runs still working in this session (In flight card for LI.FI, which has no server row). */
let liveSnapshot: RunState[] = [];
const computeLive = () => {
  const next = [...runs.values()].filter((r) => r.status === "running" && r.broadcastStarted);
  if (next.length !== liveSnapshot.length || next.some((r, i) => r !== liveSnapshot[i])) liveSnapshot = next;
  return liveSnapshot;
};
export const useLiveRuns = (): RunState[] => React.useSyncExternalStore(subscribe, computeLive, computeLive);

export const useRunByTransfer = (transferId: string | undefined): RunState | undefined =>
  React.useSyncExternalStore(
    subscribe,
    () => (transferId ? runByTransfer(transferId) : undefined),
    () => (transferId ? runByTransfer(transferId) : undefined)
  );
