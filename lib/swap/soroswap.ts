// Stellar-native swap (XLM ↔ USDC) via Soroswap, a port of web
// hooks/stellar/use-swap.tsx + sections/swap/engines/use-soroswap-engine.tsx:
//
//   quote   POST /api/swap/quote { token_in_address, token_out_address,
//           amount: NET stroops, gross_amount: GROSS stroops, mode }  (no sender)
//           → { amount_in, amount_out, min_amount_out, path, xdr:'', embedded_fee? }
//   execute embedded (server flag + upstream healthy): quote again WITH sender +
//           gross_amount → one XDR carrying our 0.5% (referralId) → ONE passkey →
//           POST /api/swap/submit-single { signedXdr, record }  → { hash }
//           fee-pair (default / 409 embedded_unavailable / any shape without
//           embedded_fee): quote NET with sender → fees/build-payment chained
//           behind it → TWO passkeys → fees/execute-pair kind 'swap'.
//
// The 0.5% Normal fee comes out of the amount the user pays (getSwapFeeAmount):
// the NET amount is what Soroswap routes, so the displayed amountOut is real.
// A Soroswap swap is a SOROBAN tx: source-account auth, envelope signature
// only (same as the DeFindex tx), fee 0.05–0.5+ XLM — see canPaySorobanFee.

import { ApiError, apiFetch } from "@/lib/api";
import { buildFeeXdr, buildRoute, signWithRetry, submitFeePair } from "@/lib/savings/engine";
import { getSwapFeeAmount } from "@/lib/savings/normal-fees";
import { awaitTxVisible } from "@/lib/stellar/send";
import { createPasskeyClient } from "@/lib/turnkey/client";

export type SwapSymbol = "XLM" | "USDC";

/** Soroban token ids the quote route accepts (web config: mainnet XLM env is
 *  blank → 'native', which the route maps to the wrapped-XLM contract). */
export const SWAP_TOKEN_ADDRESS: Record<SwapSymbol, string> = {
  XLM: "native",
  USDC: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75"
};

const STROOPS = 10_000_000;
const toStroops = (n: number) => Math.floor(n * STROOPS).toString();
const fromStroops = (s: string | undefined) => (parseInt(s || "0", 10) / STROOPS).toFixed(7);

export interface SwapQuote {
  from: SwapSymbol;
  to: SwapSymbol;
  /** Gross amount the user pays (fee included). */
  amountIn: string;
  amountOut: string;
  minAmountOut: string;
  /** Normal fee in the source token. */
  fee: string;
  path: string[];
  /** Server will try the one-signature (embedded fee) build. */
  embedded: boolean;
}

interface QuoteResponse {
  success: boolean;
  error?: string;
  embedded_unavailable?: boolean;
  path?: string[];
  amount_in?: string;
  amount_out?: string;
  min_amount_out?: string;
  xdr?: string;
  embedded_fee?: { feeBps: number; feeAmount: string };
}

const postQuote = (body: Record<string, unknown>) =>
  apiFetch<QuoteResponse>("/api/swap/quote", { body });

/** Display quote (no sender → no XDR). Public route, 30 req / 10s per IP. */
export const getSwapQuote = async (from: SwapSymbol, to: SwapSymbol, amount: number): Promise<SwapQuote> => {
  if (!(amount > 0)) throw new Error("Enter an amount.");
  const feeAmount = getSwapFeeAmount(amount);
  const net = amount - feeAmount;
  const data = await postQuote({
    token_in_address: SWAP_TOKEN_ADDRESS[from],
    token_out_address: SWAP_TOKEN_ADDRESS[to],
    amount: toStroops(net),
    gross_amount: toStroops(amount),
    mode: "strict-send"
  });
  if (!data.success) throw new Error(data.error || "Failed to get quote");
  const embedded = !!data.embedded_fee;
  return {
    from,
    to,
    amountIn: amount.toFixed(7),
    amountOut: fromStroops(data.amount_out),
    minAmountOut: fromStroops(data.min_amount_out),
    fee: embedded ? fromStroops(data.embedded_fee?.feeAmount) : feeAmount.toFixed(7),
    path: data.path ?? [],
    embedded
  };
};

export type SwapStage = "build" | "sign-swap" | "sign-fee" | "submit" | "degraded";

export interface ExecuteSwapParams {
  quote: SwapQuote;
  subOrgId: string;
  address: string;
  onStage?: (stage: SwapStage) => void;
}

export const executeSoroswap = async ({ quote, subOrgId, address, onStage }: ExecuteSwapParams): Promise<string> => {
  const tokenIn = SWAP_TOKEN_ADDRESS[quote.from];
  const tokenOut = SWAP_TOKEN_ADDRESS[quote.to];
  const gross = parseFloat(quote.amountIn);
  const display = { tokenInSymbol: quote.from, tokenOutSymbol: quote.to };

  onStage?.("build");

  // --- One signature: embedded fee -------------------------------------
  if (quote.embedded) {
    let build: QuoteResponse | null = null;
    try {
      build = await postQuote({
        token_in_address: tokenIn,
        token_out_address: tokenOut,
        amount: toStroops(gross),
        gross_amount: toStroops(gross),
        sender: address
      });
    } catch (e) {
      // 409 embedded_unavailable = the known upstream defect → fee pair below.
      const body = e instanceof ApiError ? (e.body as QuoteResponse | null) : null;
      if (!(e instanceof ApiError && e.status === 409 && body?.embedded_unavailable)) throw e;
    }
    const oneSignature = !!build?.success && !!build.xdr && !!build.embedded_fee;
    if (oneSignature && build?.xdr) {
      onStage?.("sign-swap");
      const signed = await signWithRetry({ xdr: build.xdr, subOrgId, stellarAddress: address });
      onStage?.("submit");
      try {
        const res = await apiFetch<{ success: boolean; hash?: string; error?: string }>("/api/swap/submit-single", {
          body: {
            signedXdr: signed,
            record: {
              tokenInAddress: tokenIn,
              tokenOutAddress: tokenOut,
              ...display,
              amountIn: quote.amountIn,
              amountOut: quote.amountOut,
              feeAmount: quote.fee
            }
          }
        });
        if (!res.success || !res.hash) throw new Error(res.error || "Swap submission failed");
        await awaitTxVisible(res.hash);
        return res.hash;
      } catch (e) {
        // The server refuses to broadcast a build without our fee in it — the
        // signed XDR is discarded and the fee pair runs instead.
        const body = e instanceof ApiError ? (e.body as QuoteResponse | null) : null;
        if (!(e instanceof ApiError && e.status === 409 && body?.embedded_unavailable)) throw e;
      }
    }
    onStage?.("degraded"); // copy must say "two signatures" from the first prompt
  }

  // --- Two signatures: swap + chained fee payment -----------------------
  const feeAmount = parseFloat(quote.fee);
  if (!Number.isFinite(feeAmount) || feeAmount <= 0) throw new Error("Swap fee was not computed — please refresh the quote");
  const net = gross - feeAmount;

  const swapXdr = await buildRoute("/api/swap/quote", {
    token_in_address: tokenIn,
    token_out_address: tokenOut,
    amount: toStroops(net),
    sender: address
  });
  const feeXdr = await buildFeeXdr(address, feeAmount, swapXdr, quote.from);

  const client = await createPasskeyClient();
  onStage?.("sign-swap");
  const signedSwap = await signWithRetry({ xdr: swapXdr, subOrgId, stellarAddress: address, client });
  onStage?.("sign-fee");
  const signedFee = await signWithRetry({ xdr: feeXdr, subOrgId, stellarAddress: address, client });

  onStage?.("submit");
  const pair = await submitFeePair({
    signedServiceXdr: signedSwap,
    signedFeeXdr: signedFee,
    kind: "swap",
    record: {
      tokenInAddress: tokenIn,
      tokenOutAddress: tokenOut,
      ...display,
      amountIn: net.toFixed(7),
      amountOut: quote.amountOut, // quoted, not realized (web known gap, doc 95 wave 5)
      feeAmount: feeAmount.toFixed(7)
    }
  });
  return pair.serviceHash;
};
