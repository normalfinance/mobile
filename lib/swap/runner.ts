// Starts a swap run from a RunSpec and streams progress into the run store.
// The screen that started it may be gone by the time it finishes — nothing
// here touches React. Device gate + autopilot consent happen BEFORE this,
// on the run screen.

import type { QueryClient } from "@tanstack/react-query";

import type { TurnkeyWallet } from "@/hooks/use-turnkey-wallet";
import { NATIVE_CHAIN } from "@/lib/cctp/config";
import { CalmEndError, OutboundError, runInboundSwap, runOutboundSwap } from "@/lib/cctp/engine";
import { refreshAfterStellarAction } from "@/lib/data/after-action";
import { GasShortfallError, maxAffordableEth } from "@/lib/lifi/execute";
import { executeSoroswap } from "@/lib/swap/soroswap";
import { describeTurnkeyError, isUserCancelledError } from "@/lib/turnkey/client";
import { getRun, updateRun, type RunSpec } from "./run-store";

export interface RunDeps {
  queryClient: QueryClient;
  userId: string | undefined;
  wallet: TurnkeyWallet;
  /** Live read: autopilot granted for this run (sticky, web autopilot-gate). */
  autopilotHint: () => boolean;
}

const race15 = (p: Promise<unknown>) => Promise.race([p, new Promise((r) => setTimeout(r, 15_000))]);

export const startRun = async (id: string, deps: RunDeps): Promise<void> => {
  const run = getRun(id);
  if (!run || run.status === "running") return;
  const spec: RunSpec = run.spec;
  const { queryClient, userId, wallet } = deps;
  const stellarAddress = wallet.stellarAddress!;
  updateRun(id, { status: "running", stage: null, notice: undefined, startedAt: Date.now(), flags: { autopilot: deps.autopilotHint() } });
  void queryClient.invalidateQueries({ queryKey: ["activity"] });

  try {
    if (spec.kind === "soroswap") {
      updateRun(id, { flags: { embedded: spec.quote.embedded } });
      let signedOnce = false;
      const hash = await executeSoroswap({
        quote: spec.quote,
        subOrgId: wallet.subOrgId,
        address: stellarAddress,
        onStage: (s) => {
          if (s === "sign-swap") signedOnce = true;
          if (s === "degraded") updateRun(id, { flags: { embedded: false, degradedAfterSign: signedOnce } });
          if (s === "sign-fee") updateRun(id, { flags: { embedded: false } });
          updateRun(id, { stage: s });
        }
      });
      updateRun(id, { broadcastStarted: true, stage: "refetch" });
      await race15(refreshAfterStellarAction(queryClient, { userId, stellarAddress, expectMove: [spec.from, spec.to] }));
      updateRun(id, { status: "done", stage: "done", result: { hash } });
      return;
    }

    if (spec.kind === "cctp-out") {
      const r = await runOutboundSwap({
        subOrgId: wallet.subOrgId,
        stellarAddress,
        evmAddress: wallet.ethereumAddress!,
        toSymbol: spec.to,
        toAddress: spec.toAddress,
        amount: spec.amount,
        feePercent: spec.feePercent,
        lifiTool: spec.lifiTool,
        expectedOut: String(spec.toAmount),
        // Link the row the moment it exists so In flight reopens THIS run.
        onTransferCreated: (transferId) => updateRun(id, { transferId }),
        onStage: (s) => updateRun(id, { stage: s, broadcastStarted: s !== "burn-prepare" && s !== "burn" ? true : getRun(id)?.broadcastStarted ?? false }),
        autopilotHint: deps.autopilotHint
      });
      updateRun(id, { transferId: r.transferId });
      await race15(refreshAfterStellarAction(queryClient, { userId, stellarAddress, chain: NATIVE_CHAIN[spec.to], chainAddress: spec.toAddress, expectMove: [spec.to] }));
      updateRun(id, { status: "done", stage: "done", result: { hash: r.dstSwapTxHash ?? r.burnTxHash, verdict: r.deliveryVerdict } });
      return;
    }

    // cctp-in
    const r = await runInboundSwap({
      subOrgId: wallet.subOrgId,
      stellarAddress,
      evmAddress: wallet.ethereumAddress!,
      fromSymbol: spec.from,
      addresses: { ethereumAddress: wallet.ethereumAddress, solanaAddress: wallet.solanaAddress, bitcoinAddress: wallet.bitcoinAddress },
      quote: spec.quote,
      amount: spec.amount,
      feePercent: spec.feePercent,
      expectedOut: String(spec.usdcOut),
      onTransferCreated: (transferId) => updateRun(id, { transferId }),
      onStage: (s) => updateRun(id, { stage: s, broadcastStarted: s !== "lifi" ? true : getRun(id)?.broadcastStarted ?? false }),
      autopilotHint: deps.autopilotHint,
      onAutopilotFallback: () => updateRun(id, { notice: { text: "Autopilot could not finish this step — confirming with your passkey instead.", tone: "blue" } })
    });
    updateRun(id, { transferId: r.transferId });
    await race15(refreshAfterStellarAction(queryClient, { userId, stellarAddress, expectMove: ["USDC"] }));
    updateRun(id, { status: "done", stage: "done", result: { hash: r.burnTxHash, dstAmount: r.dstAmount } });
  } catch (e) {
    if (isUserCancelledError(e)) {
      updateRun(id, { status: "idle", stage: null, notice: { text: "Cancelled — nothing was sent and nothing was charged.", tone: "blue" } });
    } else if (e instanceof GasShortfallError) {
      updateRun(id, { status: "idle", stage: null, notice: { text: "Gas moved while the quote was open — this amount plus its network fee exceeds your ETH. Use the affordable amount instead.", tone: "amber", affordable: maxAffordableEth(e) } });
    } else if (e instanceof CalmEndError) {
      if (spec.kind === "cctp-in") {
        const from = spec.from;
        await race15(refreshAfterStellarAction(queryClient, { userId, stellarAddress, chain: NATIVE_CHAIN[from], chainAddress: wallet[NATIVE_CHAIN[from] === "ethereum" ? "ethereumAddress" : NATIVE_CHAIN[from] === "solana" ? "solanaAddress" : "bitcoinAddress"], expectMove: [from] }));
      }
      updateRun(id, { status: "calm", stage: null, notice: { text: e.message, tone: "blue" } });
    } else if (e instanceof OutboundError) {
      updateRun(id, {
        status: "error",
        transferId: e.transferId,
        broadcastStarted: e.broadcastStarted,
        notice: {
          text: e.optionsExhausted
            ? "The exchange route on Base kept failing. Your USDC is safe at your own Base address — use “Bring back as USDC” under In flight to return it to Stellar."
            : e.broadcastStarted
              ? `${e.message} — your transfer continues on our servers; reopen it from In flight.`
              : e.message,
          tone: "amber"
        }
      });
    } else {
      updateRun(id, { status: "error", notice: { text: e instanceof Error ? e.message : describeTurnkeyError(e), tone: "amber" } });
    }
  } finally {
    void queryClient.invalidateQueries({ queryKey: ["cctp", "in-flight"] });
    void queryClient.invalidateQueries({ queryKey: ["activity"] });
  }
};
