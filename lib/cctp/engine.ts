// Outbound CCTP composite (Stellar USDC → BTC/ETH/SOL) — port of web
// use-cctp-engine.tsx runOutbound + the resume banner's halt-finish recovery
// + lib/cctp/refund.ts. The server owns the state machine (cctp/transfers,
// every plain GET of transfers/[id] advances it; a cron sweeps the rest); the
// client drives the legs that need the user's signature:
//
//   1. POST cctp/transfers (record BEFORE broadcast)           0 sigs
//   2. Stellar burn: approve (if needed) + deposit_for_burn   1–2 sigs
//      → PATCH { burnTxHash }
//   3. poll GET transfers/[id] to COMPLETED (Circle attests in seconds,
//      relayer mints USDC on the user's own Base address)      0 sigs
//   4. gas top-up by the relayer (POST cctp/gas-topup)         0 sigs
//   5. pivot on Base: autopilot (server signs as the user) if enrolled,
//      else approve + LI.FI swap with the passkey              0 / 1–2 sigs
//      → PATCH { dstSwapTxHash }
//   6. delivery watch via lifi/status to the target chain      0 sigs
//
// Failure rules (web findings): a reverted pivot is an ON-CHAIN outcome — never
// re-prompt the same route; record the failed bridge/DEXes and exclude them on
// the retry. Two reverts → offer the refund (Base → Stellar bridge back).
// Never move an address's WHOLE balance: scopedAmountWire (2026-08-26).

import { ApiError, apiFetch } from "@/lib/api";
import { PivotRevertError, executePivotSwap, pollPivotDelivery, readBaseEth, readBaseUsdc } from "./base";
import { burnUsdcOnBase } from "./burn-evm";
import { StellarSubmitError, burnUsdcOnStellar } from "./burn-stellar";
import {
  CCTP_DOMAIN,
  NATIVE_DECIMALS,
  SETTLEMENT_MAX_MINUTES,
  bannerPhase,
  evmAddressToBytes,
  parseFailedExchanges,
  parseFailedTool,
  usdcToWire,
  wireToUsdc,
  type CrosschainSymbol
} from "./config";

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export interface CctpTransfer {
  id: string;
  status: string;
  direction: "stellar_to_crosschain" | "crosschain_to_stellar";
  srcAsset: string;
  dstAsset: string;
  amountWire: string;
  srcAmount: string | null;
  dstAmount: string | null;
  srcAddress: string;
  destAddress: string;
  srcSwapTxHash: string | null;
  burnTxHash: string | null;
  mintTxHash: string | null;
  dstSwapTxHash: string | null;
  errorDetail: string | null;
  createdAt: string;
  quoteJson: string | null;
}

export const fetchCctpTransfers = async (history: boolean): Promise<CctpTransfer[]> => {
  const data = await apiFetch<{ transfers?: CctpTransfer[] }>("/api/cctp/transfers", history ? { query: { history: 1 } } : {});
  return data?.transfers ?? [];
};

const getTransfer = (id: string, advance: boolean) =>
  apiFetch<{ transfer?: CctpTransfer }>(`/api/cctp/transfers/${id}`, advance ? {} : { query: { noAdvance: 1 } }).then((d) => d?.transfer ?? null);

/** Money-state writes never swallow: 3 attempts, then the caller SAYS it. */
const patchTransfer = async (id: string, body: Record<string, string | boolean>): Promise<CctpTransfer | null> => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const d = await apiFetch<{ transfer?: CctpTransfer }>(`/api/cctp/transfers/${id}`, { method: "PATCH", body });
      return d?.transfer ?? null;
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) return null; // "nothing to update"
    }
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  return null;
};

/** Poll the row (each read advances it server-side) until `target`. */
const pollStatus = async (id: string, target: string, intervalMs: number, isCancelled: () => boolean): Promise<void> => {
  let misses = 0;
  for (;;) {
    if (isCancelled()) throw new Error("cancelled");
    let status: string | undefined;
    let detail: string | null | undefined;
    let saw = false;
    try {
      const tr = await getTransfer(id, true);
      status = tr?.status;
      detail = tr?.errorDetail;
      saw = typeof status === "string";
    } catch {
      /* transient — the cron keeps advancing; retry */
    }
    if (status === target) return;
    if (status === "FAILED") throw new Error(detail ?? "transfer failed");
    misses = saw ? 0 : misses + 1;
    if (misses >= 10) throw new Error("Lost connection while tracking this swap — it continues on our servers. Check Activity in a few minutes.");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
};

/** Relayer gas top-up (idempotent; 409 = already running), then wait until the
 *  Base address actually holds ETH — verified by balance, not a blind timer. */
const topUp = async (id: string, evmAddress: string): Promise<void> => {
  let ok = false;
  for (let attempt = 0; attempt < 3 && !ok; attempt += 1) {
    try {
      await apiFetch("/api/cctp/gas-topup", { body: { transferId: id } });
      ok = true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) ok = true;
      else await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  if (!ok) throw new Error("Gas top-up failed — try again in a moment.");
  try {
    for (let i = 0; i < 10; i += 1) {
      if ((await readBaseEth(evmAddress)) > 0n) return;
      await new Promise((r) => setTimeout(r, 2000));
    }
  } catch {
    /* balance probe unavailable — the tx itself will tell */
  }
};

const autopilotActive = async (): Promise<boolean> => {
  try {
    const d = await apiFetch<{ active?: boolean }>("/api/autopilot/status");
    return d?.active === true;
  } catch {
    return false;
  }
};

interface AutoPivotResult {
  txHash?: `0x${string}`;
  toAmountMin?: string;
  fromChainId?: number;
  toChainId?: number;
  __reverted?: boolean;
  tool?: string | null;
  exchanges?: string[];
}

/** Server-side pivot (signs AS the user via the delegated Turnkey key). null = fall back to the passkey path. */
const tryAutopilotPivot = async (id: string, deny?: { denyBridges?: string[]; denyExchanges?: string[] }): Promise<AutoPivotResult | null> => {
  try {
    const d = await apiFetch<{ success?: boolean } & AutoPivotResult>("/api/cctp/autopilot/pivot", { body: { transferId: id, ...(deny ?? {}) } });
    return d?.success && d.txHash ? d : null;
  } catch (e) {
    const body = e instanceof ApiError ? (e.body as { failureClass?: string; tool?: string; txHash?: string; exchanges?: string[] } | null) : null;
    if (e instanceof ApiError && e.status === 502 && body?.failureClass === "reverted") {
      return { __reverted: true, tool: body.tool ?? null, txHash: body.txHash as `0x${string}`, exchanges: body.exchanges ?? [] };
    }
    return null;
  }
};

/** How much of a Base USDC balance belongs to THIS transfer (web amounts.ts). */
export const scopedAmountWire = (available: bigint, expected: bigint): bigint => {
  if (available <= 0n) return 0n;
  if (expected <= 0n) return available;
  const cap = expected + expected / 20n; // 5% positive-slippage headroom
  return available > cap ? cap : available;
};

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

export type OutboundStage = "burn-prepare" | "burn" | "bridging" | "topup" | "pivot-swap" | "delivering" | "done";

export interface OutboundParams {
  subOrgId: string;
  stellarAddress: string;
  evmAddress: string;
  toSymbol: CrosschainSymbol;
  /** The user's address on the target chain. */
  toAddress: string;
  /** Human USDC amount, ≤ 6 decimals. */
  amount: string;
  /** LI.FI feePercent from the display quote (recorded on the row). */
  feePercent: number;
  lifiTool: string | null;
  onStage?: (s: OutboundStage) => void;
  /** Fires before each passkey prompt (burn legs). */
  onSigning?: () => void;
  isCancelled?: () => boolean;
  /** Consent was granted in this session — try the server pivot even if the
   *  status read hasn't caught up (an optimistic yes costs one refused call). */
  autopilotHint?: boolean | (() => boolean);
}

export interface OutboundResult {
  transferId: string;
  burnTxHash: string;
  dstSwapTxHash: string | null;
  deliveryVerdict: "DONE" | "REFUNDED" | "FAILED" | null;
  usedAutopilot: boolean;
  /** true = the pivot reverted twice — the caller should offer the refund. */
  optionsExhausted?: boolean;
}

export class OutboundError extends Error {
  transferId: string;
  stage: OutboundStage;
  /** Money reached a chain: recovery goes through the in-flight card, not "try again". */
  broadcastStarted: boolean;
  optionsExhausted: boolean;
  constructor(message: string, o: { transferId: string; stage: OutboundStage; broadcastStarted: boolean; optionsExhausted?: boolean }) {
    super(message);
    this.transferId = o.transferId;
    this.stage = o.stage;
    this.broadcastStarted = o.broadcastStarted;
    this.optionsExhausted = !!o.optionsExhausted;
  }
}

const finishPivot = async (
  transferId: string,
  toSymbol: CrosschainSymbol,
  result: { txHash: string; toAmountMin: string; fromChainId?: number; toChainId?: number },
  onStage: ((s: OutboundStage) => void) | undefined,
  isCancelled: () => boolean
): Promise<"DONE" | "REFUNDED" | "FAILED" | null> => {
  const dec = NATIVE_DECIMALS[toSymbol];
  const min = BigInt(result.toAmountMin || "0");
  const s = min.toString().padStart(dec + 1, "0");
  const dstAmount = `${s.slice(0, s.length - dec)}.${s.slice(s.length - dec)}`.replace(/\.?0+$/, "") || "0";
  if (!result.fromChainId || !result.toChainId) {
    await patchTransfer(transferId, { dstAmount });
    return null;
  }
  onStage?.("delivering");
  const maxPolls = Math.ceil((SETTLEMENT_MAX_MINUTES[toSymbol] * 60 * 1.5) / 10);
  const delivery = await pollPivotDelivery(result.txHash, result.fromChainId, result.toChainId, maxPolls, isCancelled);
  if (delivery.verdict === "FAILED" || delivery.verdict === "REFUNDED") {
    throw new Error("The final swap leg did not deliver — your USDC is at your own Base address, untouched by anyone else. Contact support to recover it.");
  }
  await patchTransfer(transferId, delivery.deliveredAmount ? { dstAmountFinal: delivery.deliveredAmount } : { dstAmount });
  return delivery.verdict;
};

export const runOutboundSwap = async (p: OutboundParams): Promise<OutboundResult> => {
  const isCancelled = p.isCancelled ?? (() => false);
  const amountWire = usdcToWire(p.amount);

  // 1. The row exists BEFORE anything is broadcast (#27).
  const created = await apiFetch<{ id?: string; error?: string }>("/api/cctp/transfers", {
    body: {
      direction: "stellar_to_crosschain",
      sourceDomain: CCTP_DOMAIN.stellar,
      destDomain: CCTP_DOMAIN.base,
      amountWire: amountWire.toString(),
      srcAsset: "USDC",
      dstAsset: p.toSymbol,
      srcAmount: p.amount,
      srcAddress: p.stellarAddress,
      destAddress: p.evmAddress, // the gas top-up must reach the EVM pivot address
      quoteJson: { feePercent: p.feePercent, lifiTool: p.lifiTool, fundedFrom: "normal" }
    }
  });
  if (!created?.id) throw new Error(created?.error ?? "Could not start the swap");
  const transferId = created.id;
  let stage: OutboundStage = "burn-prepare";
  let broadcastStarted = false;
  const setStage = (s: OutboundStage) => {
    stage = s;
    p.onStage?.(s);
  };

  try {
    // 2. Burn on Stellar (1–2 passkeys). 'burn-prepare' covers the silent
    //    simulate window; onSigning flips to 'burn' when the prompt appears.
    setStage("burn-prepare");
    let burnTxHash: string;
    try {
      const r = await burnUsdcOnStellar({
        subOrgId: p.subOrgId,
        stellarAddress: p.stellarAddress,
        amountWire,
        destinationDomain: CCTP_DOMAIN.base,
        mintRecipient: evmAddressToBytes(p.evmAddress),
        onSigning: () => {
          setStage("burn");
          p.onSigning?.();
        }
      });
      burnTxHash = r.burnTxHash;
    } catch (e) {
      // A timed-out submit may still land — keep the hash on the row so the
      // cron/in-flight card can finish it instead of stranding a burn.
      if (e instanceof StellarSubmitError && e.mayStillLand && e.txHash) {
        broadcastStarted = true;
        await patchTransfer(transferId, { burnTxHash: e.txHash });
      }
      throw e;
    }
    broadcastStarted = true;
    const patched = await patchTransfer(transferId, { burnTxHash });
    if (!patched) throw new Error("We could not record the burn — your funds are safe. Reopen Swap in a minute; the transfer resumes from In flight.");

    // 3. Bridge: attestation in seconds, relayer mints on Base.
    setStage("bridging");
    await pollStatus(transferId, "COMPLETED", 5_000, isCancelled);

    // 4/5. Pivot on Base — autopilot first (0 prompts), else top-up + passkey.
    setStage("topup");
    let result: { txHash: string; toAmountMin: string; fromChainId?: number; toChainId?: number } | null = null;
    let usedAutopilot = false;
    const hinted = typeof p.autopilotHint === "function" ? p.autopilotHint() : !!p.autopilotHint;
    if (hinted || (await autopilotActive())) {
      let auto = await tryAutopilotPivot(transferId);
      if (auto?.__reverted) {
        const first = auto;
        auto = first.tool || first.exchanges?.length
          ? await tryAutopilotPivot(transferId, { denyBridges: first.tool ? [first.tool] : undefined, denyExchanges: first.exchanges?.length ? first.exchanges : undefined })
          : null;
        if (!auto || auto.__reverted) {
          setStage("pivot-swap");
          throw new OutboundError("The exchange route kept failing on Base — your USDC is safe at your own Base address.", {
            transferId,
            stage: "pivot-swap",
            broadcastStarted: true,
            optionsExhausted: true
          });
        }
      }
      if (auto?.txHash) {
        usedAutopilot = true;
        setStage("pivot-swap");
        result = { txHash: auto.txHash, toAmountMin: auto.toAmountMin ?? "0", fromChainId: auto.fromChainId, toChainId: auto.toChainId };
      }
    }
    if (!result) {
      await topUp(transferId, p.evmAddress);
      setStage("pivot-swap");
      const bal = await readBaseUsdc(p.evmAddress);
      const pivotWire = scopedAmountWire(bal, amountWire);
      if (pivotWire === 0n) throw new Error("No USDC found on Base yet — it may still be minting. Check In flight in a minute.");
      try {
        const r = await executePivotSwap({ subOrgId: p.subOrgId, evmAddress: p.evmAddress, toSymbol: p.toSymbol, toAddress: p.toAddress, amountWire: pivotWire });
        result = r;
      } catch (e) {
        if (e instanceof PivotRevertError) {
          await patchTransfer(transferId, { pivotRevertTool: e.tool ?? "", pivotRevertTxHash: e.txHash, pivotRevertExchanges: e.exchanges.join("+") });
        }
        throw e;
      }
      await patchTransfer(transferId, { dstSwapTxHash: result.txHash });
    }

    // 6. Delivery on the target chain.
    const verdict = await finishPivot(transferId, p.toSymbol, result, setStage, isCancelled);
    setStage("done");
    return { transferId, burnTxHash, dstSwapTxHash: result.txHash, deliveryVerdict: verdict, usedAutopilot };
  } catch (e) {
    if (!broadcastStarted) await patchTransfer(transferId, { markFailed: true }).catch(() => null);
    if (e instanceof OutboundError) throw e;
    throw new OutboundError(e instanceof Error ? e.message : String(e), { transferId, stage, broadcastStarted });
  }
};

// ---------------------------------------------------------------------------
// Recovery from the in-flight card (web cctp-resume-banner recover(), outbound)
// ---------------------------------------------------------------------------

export const recoverOutbound = async (p: {
  subOrgId: string;
  row: CctpTransfer;
  toAddress: string;
  onStage?: (s: OutboundStage) => void;
  isCancelled?: () => boolean;
}): Promise<"DONE" | "REFUNDED" | "FAILED" | null> => {
  const tr = p.row;
  const toSymbol = tr.dstAsset as CrosschainSymbol;
  p.onStage?.("topup");
  await topUp(tr.id, tr.destAddress);
  const bal = await readBaseUsdc(tr.destAddress);
  if (bal === 0n) throw new Error("No USDC found on Base — it may already be on its way.");
  // Read the row FRESH: the failed bridge/DEXes recorded by the last revert
  // are the deny list for this retry.
  const fresh = (await getTransfer(tr.id, false).catch(() => null)) ?? tr;
  const denyBridges = [parseFailedTool(fresh.errorDetail)].filter((x): x is string => !!x);
  const denyExchanges = parseFailedExchanges(fresh.errorDetail);
  p.onStage?.("pivot-swap");
  let result;
  try {
    result = await executePivotSwap({
      subOrgId: p.subOrgId,
      evmAddress: tr.destAddress,
      toSymbol,
      toAddress: p.toAddress,
      amountWire: scopedAmountWire(bal, BigInt(tr.amountWire)),
      denyBridges: denyBridges.length ? denyBridges : undefined,
      denyExchanges: denyExchanges.length ? denyExchanges : undefined
    });
  } catch (e) {
    if (e instanceof PivotRevertError) {
      await patchTransfer(tr.id, { pivotRevertTool: e.tool ?? "", pivotRevertTxHash: e.txHash, pivotRevertExchanges: e.exchanges.join("+") });
    }
    throw e;
  }
  await patchTransfer(tr.id, { dstSwapTxHash: result.txHash });
  return finishPivot(tr.id, toSymbol, result, p.onStage, p.isCancelled ?? (() => false));
};

/** Bring minted-but-stuck USDC on Base back to the user's Stellar account
 *  (a fresh Base → Stellar bridge; the original row retires as REFUNDED). */
export const refundOutbound = async (p: {
  subOrgId: string;
  row: CctpTransfer;
  onStage?: (s: "topup" | "burn") => void;
  autopilotHint?: boolean;
}): Promise<{ newId: string; burnTxHash: string }> => {
  const tr = p.row;
  const bal = await readBaseUsdc(tr.destAddress);
  if (bal === 0n) throw new Error("No USDC found on Base — it may already be moving.");
  const refundWire = bal; // a refund is a sweep (web refund.ts): recover the lot
  const created = await apiFetch<{ id?: string; error?: string }>("/api/cctp/transfers", {
    body: {
      direction: "crosschain_to_stellar",
      sourceDomain: CCTP_DOMAIN.base,
      destDomain: CCTP_DOMAIN.stellar,
      amountWire: refundWire.toString(),
      srcAsset: "USDC",
      dstAsset: "USDC",
      srcAmount: wireToUsdc(refundWire),
      srcAddress: tr.destAddress,
      destAddress: tr.srcAddress,
      refund: true,
      refundOfTransferId: tr.id
    }
  });
  if (!created?.id) throw new Error(created?.error ?? "Could not start the refund.");
  const newId = created.id;
  p.onStage?.("topup");
  await topUp(newId, tr.destAddress);
  p.onStage?.("burn");
  // Autopilot burn first (0 prompts) when enrolled; else the passkey burn.
  if (p.autopilotHint || (await autopilotActive())) {
    try {
      const d = await apiFetch<{ success?: boolean; burnTxHash?: string }>("/api/cctp/autopilot/burn", { body: { transferId: newId } });
      if (d?.success && d.burnTxHash) {
        await patchTransfer(tr.id, { markRefunded: "true" });
        return { newId, burnTxHash: d.burnTxHash };
      }
    } catch {
      /* fall through to the passkey burn */
    }
  }
  const { burnTxHash } = await burnUsdcOnBase({ subOrgId: p.subOrgId, evmAddress: tr.destAddress, amountWire: refundWire, stellarRecipient: tr.srcAddress });
  await patchTransfer(newId, { burnTxHash, dstAmount: wireToUsdc(refundWire) });
  await patchTransfer(tr.id, { markRefunded: "true" });
  return { newId, burnTxHash };
};

export { bannerPhase };
