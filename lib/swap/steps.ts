// The step lists for the three swap routes — one definition, used by the run
// screen (live), the resume view (from a server row) and the completion view.

import type { Step } from "@/components/savings/StepList";
import type { RunSpec, RunState } from "./run-store";

export const stepsFor = (spec: RunSpec, flags: RunState["flags"], stage: string | null): Step[] => {
  if (spec.kind === "soroswap") {
    const two = !spec.quote.embedded || flags.embedded === false;
    return [
      { id: "build", label: "Preparing the swap", sub: "Building your transaction" },
      {
        id: "sign",
        label: "Confirm with passkey",
        sub: flags.degradedAfterSign
          ? "The one-signature route was refused — two more confirmations: the swap, then the fee"
          : stage === "sign-fee"
            ? "Now the Normal fee · 2 of 2"
            : two
              ? "Two confirmations: the swap, then the Normal fee"
              : "One confirmation — the fee is inside the swap"
      },
      { id: "submit", label: "Submitting to Stellar", sub: "Broadcasting — usually a few seconds" },
      { id: "refetch", label: "Updating balances", sub: "Waiting until your wallet shows the result" }
    ];
  }
  if (spec.kind === "lifi") {
    const chainOf = (s: string) => (s === "BTC" ? "Bitcoin" : s === "ETH" ? "Ethereum" : "Solana");
    return [
      { id: "sign", label: "Confirm with passkey", sub: spec.from === "BTC" ? "One confirmation — signs every input at once" : "One confirmation on " + chainOf(spec.from) },
      { id: "confirming", label: `Confirming on ${chainOf(spec.from)}`, sub: spec.from === "BTC" ? "Broadcast accepted — the bridge watches the mempool" : spec.from === "ETH" ? "Waiting for the receipt — usually under a minute" : "Waiting for confirmation — a few seconds" },
      { id: "bridging", label: `Bridging to ${chainOf(spec.to)}`, sub: `${spec.tool ? `Via ${spec.tool} · ` : ""}${spec.etaMin ? `~${spec.etaMin} min` : "a few minutes"} — automatic, safe to close` }
    ];
  }
  if (spec.kind === "cctp-out" && flags.refunding) {
    // Both automatic pivot attempts reverted — web doc 93 0b: the refund starts
    // ITSELF; the list becomes the refund track (Circle bridge back to Stellar).
    return [
      { id: "burn-prepare", label: "Preparing the bridge transaction", sub: "Done" },
      { id: "burn", label: "Starting the Circle bridge", sub: "Done" },
      { id: "bridging", label: "Bridging to Base", sub: "Done — USDC arrived at your own Base address" },
      { id: "pivot-swap", label: `Swapping USDC to ${spec.to}`, sub: "The exchange route kept failing on Base" },
      { id: "refund-topup", label: "Covering network fees", sub: "Normal sends gas to your Base address" },
      { id: "refund-burn", label: "Sending your USDC back", sub: flags.autopilot ? "Automatic — no signature needed" : "Confirm with passkey · 1–2 confirmations" },
      { id: "refund-bridging", label: "Bridging back to Stellar", sub: "Circle attestation ~20 min — safe to close" }
    ];
  }
  if (spec.kind === "cctp-out") {
    return [
      { id: "burn-prepare", label: "Preparing the bridge transaction", sub: "A few seconds — no action needed yet" },
      { id: "burn", label: "Starting the Circle bridge", sub: "Confirm with passkey · 1–2 confirmations" },
      { id: "bridging", label: "Bridging to Base", sub: "Circle attestation — about a minute" },
      { id: "topup", label: "Covering network fees", sub: "Normal sends gas to your address" },
      { id: "pivot-swap", label: `Swapping USDC to ${spec.to}`, sub: flags.autopilot ? "Via LI.FI · automatic — no signature needed" : "Via LI.FI · confirm with passkey" },
      { id: "delivering", label: `Delivering ${spec.to}`, sub: `Cross-chain arrival — up to ${spec.to === "BTC" ? "60" : "5"} min` }
    ];
  }
  return [
    { id: "lifi", label: `Swapping ${spec.from} to USDC`, sub: "Via LI.FI · confirm with passkey" },
    { id: "arriving", label: "USDC arriving on Base", sub: `Cross-chain delivery — ${spec.etaMin ? `~${Math.max(1, spec.etaMin - 20)} min` : "a few minutes"}` },
    { id: "topup", label: "Covering network fees", sub: "Normal sends gas to your address" },
    { id: "burn", label: "Starting the Circle bridge", sub: flags.autopilot ? "Automatic — no signature needed" : "Confirm with passkey · 1–2 confirmations" },
    { id: "bridging", label: "Bridging to Stellar", sub: "Circle attestation ~20 min — safe to close" }
  ];
};

/** Which step is lit for a raw engine stage. */
export const activeStepFor = (spec: RunSpec, stage: string | null): string | null => {
  if (!stage || stage === "done") return null;
  if (spec.kind === "soroswap") return stage === "sign-swap" || stage === "sign-fee" ? "sign" : stage === "degraded" ? "build" : stage;
  return stage;
};

export const timingFor = (spec: RunSpec): string => (spec.kind === "soroswap" ? "~30s" : spec.etaMin ? `~${spec.etaMin} min` : "");

const NATIVE_EXPLORER: Record<string, (h: string) => string> = {
  BTC: (h) => `https://mempool.space/tx/${h}`,
  ETH: (h) => `https://etherscan.io/tx/${h}`,
  SOL: (h) => `https://solscan.io/tx/${h}`
};

/** Explorer for the hash a run ends with: Stellar (Soroswap), Base (CCTP legs), or the LI.FI source chain. */
export const explorerFor = (spec: RunSpec, hash: string): string =>
  spec.kind === "soroswap" ? `https://stellar.expert/explorer/public/tx/${hash}` : spec.kind === "lifi" ? NATIVE_EXPLORER[spec.from](hash) : `https://basescan.org/tx/${hash}`;
