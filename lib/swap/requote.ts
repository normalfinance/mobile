// Re-price a run at a different amount, in place — used by the run page's
// "Use the affordable amount" resolution after a pre-sign gas shortfall
// (web: onAmountAdjusted writes the amount back into the card and the user
// reviews the fresh quote; here the user stays on the run page with the
// refreshed numbers and presses Start again). Only the LI.FI-quoted kinds can
// hit a gas shortfall (ETH source), so only those are re-quoted.

import type { TurnkeyWallet } from "@/hooks/use-turnkey-wallet";
import { NATIVE_CHAIN, NATIVE_DECIMALS } from "@/lib/cctp/config";
import { fetchLifiQuote } from "@/lib/lifi/execute";
import type { RunSpec } from "./run-store";

const toBaseUnits = (amount: number, decimals: number): string => {
  const [w, f = ""] = amount.toFixed(decimals).split(".");
  return (BigInt(w) * BigInt(10) ** BigInt(decimals) + BigInt(f.padEnd(decimals, "0"))).toString();
};

const addressOf = (wallet: TurnkeyWallet, chain: "bitcoin" | "ethereum" | "solana") =>
  wallet[chain === "ethereum" ? "ethereumAddress" : chain === "solana" ? "solanaAddress" : "bitcoinAddress"];

export const requoteAt = async (spec: RunSpec, wallet: TurnkeyWallet, amount: string): Promise<RunSpec> => {
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) throw new Error("That amount is not usable.");
  if (spec.kind === "lifi") {
    const fromAddress = addressOf(wallet, NATIVE_CHAIN[spec.from]);
    const toAddress = addressOf(wallet, NATIVE_CHAIN[spec.to]);
    if (!fromAddress || !toAddress) throw new Error("Wallet addresses are missing.");
    const res = await fetchLifiQuote({ fromSymbol: spec.from, toSymbol: spec.to, fromAmount: toBaseUnits(amountNum, NATIVE_DECIMALS[spec.from]), fromAddress, toAddress });
    if (!res.success || !res.quote?.estimate?.toAmount) throw new Error(res.error ?? "No route right now");
    return {
      ...spec,
      amount: amountNum.toString(),
      quote: res.quote,
      feePercent: typeof res.feePercent === "number" ? res.feePercent : 0,
      etaMin: Math.max(1, Math.round(res.quote.estimate.executionDuration / 60)),
      toAmount: Number(res.quote.estimate.toAmount) / 10 ** NATIVE_DECIMALS[spec.to],
      tool: res.quote.tool ?? null
    };
  }
  if (spec.kind === "cctp-in") {
    const fromAddress = addressOf(wallet, NATIVE_CHAIN[spec.from]);
    const evmAddress = wallet.ethereumAddress;
    if (!fromAddress || !evmAddress) throw new Error("Wallet addresses are missing.");
    const res = await fetchLifiQuote({ fromSymbol: spec.from, toSymbol: "USDC_BASE", fromAmount: toBaseUnits(amountNum, NATIVE_DECIMALS[spec.from]), fromAddress, toAddress: evmAddress });
    if (!res.success || !res.quote?.estimate?.toAmountMin) throw new Error(res.error ?? "No route right now");
    return {
      ...spec,
      amount: amountNum.toString(),
      quote: res.quote,
      feePercent: typeof res.feePercent === "number" ? res.feePercent : 0,
      etaMin: Math.max(1, Math.round(res.quote.estimate.executionDuration / 60)) + 20,
      usdcOut: Number(res.quote.estimate.toAmountMin) / 1e6
    };
  }
  throw new Error("This swap can’t be re-priced here.");
};
