// Starts a swap run from a RunSpec and streams progress into the run store.
// The screen that started it may be gone by the time it finishes — nothing
// here touches React. Device gate + autopilot consent happen BEFORE this,
// on the run screen.

import type { QueryClient } from "@tanstack/react-query";

import type { TurnkeyWallet } from "@/hooks/use-turnkey-wallet";
import { NATIVE_CHAIN, NATIVE_DECIMALS } from "@/lib/cctp/config";
import { CalmEndError, OutboundError, fetchCctpTransfer, refundOutbound, runInboundSwap, runOutboundSwap } from "@/lib/cctp/engine";
import { refreshAfterStellarAction } from "@/lib/data/after-action";
import { GasShortfallError, LIFI_CHAIN_IDS, executeLifiSwap, maxAffordableEth } from "@/lib/lifi/execute";
import { addPendingLifi, loadPendingLifi, markLifiRecorded, removePendingLifi, type PendingLifi } from "@/lib/lifi/pending-lifi";
import { trackLifiSwap, type LifiTrackedTx } from "@/lib/lifi/tracker";
import { executeSoroswap } from "@/lib/swap/soroswap";
import { describeTurnkeyError, isUserCancelledError } from "@/lib/turnkey/client";
import { getRun, restoreRun, runBySourceTx, updateRun, type RunSpec } from "./run-store";

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
  updateRun(id, { status: "running", stage: null, notice: undefined, failedStage: undefined, refundedStage: undefined, startedAt: Date.now(), flags: { autopilot: deps.autopilotHint(), refunding: false } });
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

    if (spec.kind === "lifi") {
      // One passkey on the source chain, then the bridge (THORChain / Chainflip /
      // Relay …) delivers to the user's own destination address. No server row —
      // lifi/record (inside the tracker) is the swap's only activity row.
      updateRun(id, { stage: "sign" });
      const addresses = { ethereumAddress: wallet.ethereumAddress, solanaAddress: wallet.solanaAddress, bitcoinAddress: wallet.bitcoinAddress };
      const txHash = await executeLifiSwap(spec.quote, addresses, wallet.subOrgId);
      updateRun(id, { broadcastStarted: true, sourceTxHash: txHash, stage: "confirming" });
      const tx: LifiTrackedTx = {
        txHash,
        fromChainId: spec.quote.action.fromChainId,
        toChainId: spec.quote.action.toChainId,
        fromSymbol: spec.from,
        toSymbol: spec.to,
        amountIn: spec.amount,
        amountOut: String(spec.toAmount),
        feeAmount: spec.feePercent > 0 ? (parseFloat(spec.amount) * spec.feePercent).toFixed(8) : undefined
      };
      // Persist BEFORE tracking: a killed app finishes the record on next launch.
      addPendingLifi({ ...tx, fromSymbol: spec.from, toSymbol: spec.to, toAmountMin: spec.quote.estimate.toAmountMin, feePercent: spec.feePercent, etaMin: spec.etaMin, tool: spec.tool });
      resumed.add(txHash); // never restore what this session is already tracking
      await trackLifiRun(id, tx, deps, false);
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
      updateRun(id, { status: "calm", stage: null, refundedStage: /refund|returned|back/i.test(e.message) ? getRun(id)?.stage ?? undefined : undefined, notice: { text: e.message, tone: "blue" } });
    } else if (e instanceof OutboundError && e.optionsExhausted && spec.kind === "cctp-out") {
      // Web doc 93 0b: no dead-end errors — the refund starts ITSELF.
      // Autopilot users see zero prompts; others get the one burn confirmation.
      updateRun(id, { status: "running", transferId: e.transferId, broadcastStarted: true, stage: "refund-topup", flags: { refunding: true }, notice: { text: "The exchange route kept failing on Base — bringing your USDC back to Stellar automatically.", tone: "blue" } });
      try {
        const row = await fetchCctpTransfer(e.transferId, false);
        if (!row) throw new Error("Could not load the transfer.");
        const r = await refundOutbound({ subOrgId: wallet.subOrgId, row, autopilotHint: deps.autopilotHint(), onStage: (s) => updateRun(id, { stage: s === "topup" ? "refund-topup" : "refund-burn" }) });
        updateRun(id, { status: "calm", stage: null, refundedStage: "refund-bridging", result: { hash: r.burnTxHash }, notice: { text: "Your USDC is on its way back to your Stellar wallet — completes automatically in about 20 minutes. Nothing else to do.", tone: "blue" } });
      } catch (re) {
        updateRun(id, {
          status: "error",
          failedStage: getRun(id)?.stage ?? "pivot-swap",
          notice: { text: isUserCancelledError(re) ? "The refund needs one confirmation — reopen this swap from In flight and tap “Bring back as USDC” when ready. Your USDC is safe at your own Base address." : `${re instanceof Error ? re.message : describeTurnkeyError(re)} — your USDC is safe at your own Base address; use “Bring back as USDC” under In flight.`, tone: "amber" }
        });
      }
    } else if (e instanceof OutboundError) {
      updateRun(id, {
        status: "error",
        transferId: e.transferId,
        broadcastStarted: e.broadcastStarted,
        failedStage: e.stage,
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
      updateRun(id, { status: "error", failedStage: getRun(id)?.stage ?? undefined, notice: { text: e instanceof Error ? e.message : describeTurnkeyError(e), tone: "amber" } });
    }
  } finally {
    void queryClient.invalidateQueries({ queryKey: ["cctp", "in-flight"] });
    void queryClient.invalidateQueries({ queryKey: ["activity"] });
  }
};

const nativeAddress = (wallet: TurnkeyWallet, chain: "bitcoin" | "ethereum" | "solana") =>
  wallet[chain === "ethereum" ? "ethereumAddress" : chain === "solana" ? "solanaAddress" : "bitcoinAddress"] ?? undefined;

/** Track a broadcast LI.FI swap to its end and write the outcome into the run (live or restored). */
const trackLifiRun = async (id: string, tx: LifiTrackedTx, deps: RunDeps, alreadyRecorded: boolean): Promise<void> => {
  const run = getRun(id);
  if (!run || run.spec.kind !== "lifi") return;
  const spec = run.spec;
  const { queryClient, userId, wallet } = deps;
  const stellarAddress = wallet.stellarAddress ?? undefined;
  const toChain = NATIVE_CHAIN[spec.to];
  const final = await trackLifiSwap(tx, {
    stellarAddress,
    skipRecord: alreadyRecorded,
    onStage: (s) => updateRun(id, { stage: s }),
    onRecorded: () => {
      markLifiRecorded(tx.txHash);
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
    // Hard rule 14: the destination chain's balance is refetched BEFORE "Done".
    onArrival: () => refreshAfterStellarAction(queryClient, { userId, stellarAddress: stellarAddress!, chain: toChain, chainAddress: nativeAddress(wallet, toChain), expectMove: [spec.to] })
  });
  if (final === "done") {
    removePendingLifi(tx.txHash);
    updateRun(id, { status: "done", stage: "done", result: { hash: tx.txHash, verdict: "DONE" } });
  } else if (final === "refunded") {
    removePendingLifi(tx.txHash);
    // Source chain moved back — refresh it so the balance is honest.
    const fromChain = NATIVE_CHAIN[spec.from];
    await race15(refreshAfterStellarAction(queryClient, { userId, stellarAddress: stellarAddress!, chain: fromChain, chainAddress: nativeAddress(wallet, fromChain), expectMove: [spec.from] }));
    updateRun(id, { status: "calm", stage: null, refundedStage: "bridging", result: { hash: tx.txHash, verdict: "REFUNDED" }, notice: { text: `The bridge couldn’t complete this swap and returned your ${spec.from}. No funds were lost — small swaps are sometimes refunded.`, tone: "blue" } });
  } else if (final === "failed") {
    removePendingLifi(tx.txHash);
    updateRun(id, { status: "error", failedStage: "confirming", result: { hash: tx.txHash, verdict: "FAILED" }, notice: { text: `The ${spec.from} transaction didn’t confirm. If it never left your wallet nothing was spent; if it did, the bridge returns it automatically — check Activity for the final state.`, tone: "amber" } });
  } else {
    // No verdict within the destination's window: keep the ledger entry so the
    // next launch resumes tracking; Activity keeps its Pending row meanwhile.
    updateRun(id, { status: "calm", stage: null, result: { hash: tx.txHash, verdict: "PENDING" }, notice: { text: `Your ${spec.to} is still on its way — this route can take a while. It arrives automatically at your own address; the Activity row keeps tracking it.`, tone: "blue" } });
  }
};

const resumed = new Set<string>();
/** On launch: restore every unsettled LI.FI swap from the ledger as a live run and track it. */
export const resumePendingLifiRuns = async (deps: RunDeps): Promise<void> => {
  const entries = await loadPendingLifi();
  for (const p of entries) {
    // Already tracked here — by an earlier resume, or by the live run that
    // broadcast it this session (the ledger is written at broadcast).
    if (resumed.has(p.txHash) || runBySourceTx(p.txHash)) continue;
    resumed.add(p.txHash);
    void resumeOne(p, deps);
  }
};

const resumeOne = async (p: PendingLifi, deps: RunDeps) => {
  const id = `lifi-${p.txHash}`;
  const decimals = NATIVE_DECIMALS[p.toSymbol];
  const toAmount = parseFloat(p.amountOut) || 0;
  const spec: RunSpec = {
    kind: "lifi",
    from: p.fromSymbol,
    to: p.toSymbol,
    amount: p.amountIn,
    // A stub quote: only the fields the header, details and tracker read.
    quote: {
      tool: p.tool ?? undefined,
      action: { fromChainId: p.fromChainId, toChainId: p.toChainId, fromAmount: "0" },
      estimate: { toAmount: String(Math.round(toAmount * 10 ** decimals)), toAmountMin: p.toAmountMin, executionDuration: (p.etaMin ?? 1) * 60 },
      transactionRequest: { data: "" }
    },
    feePercent: p.feePercent,
    etaMin: p.etaMin,
    toAmount,
    tool: p.tool
  };
  restoreRun({ id, spec, status: "running", stage: "confirming", flags: {}, broadcastStarted: true, sourceTxHash: p.txHash, startedAt: p.createdAt });
  const { txHash, fromChainId, toChainId, fromSymbol, toSymbol, amountIn, amountOut, feeAmount } = p;
  await trackLifiRun(id, { txHash, fromChainId, toChainId, fromSymbol, toSymbol, amountIn, amountOut, feeAmount }, deps, p.recorded);
};
