// Cross-chain panel, native ⇄ native (BTC / ETH / SOL) via LI.FI — port of
// web sections/swap/engines/use-lifi-engine.tsx. One passkey on the source
// chain; the bridge (THORChain / Chainflip / Relay …) delivers to the user's
// OWN address on the destination chain. The run itself lives on /swap-run.

import React from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { XStack, YStack } from "tamagui";

import { Card, Mono, PrimaryButton, UiText } from "@/components/home/primitives";
import { AmountInput, ReceiveBox, SwapMiddle } from "@/components/swap/AmountInput";
import { setPendingRun } from "@/lib/swap/run-store";
import { useBackendPortfolio } from "@/hooks/use-backend-portfolio";
import { turnkeyWalletQueryKey, useTurnkeyWallet, type WalletChain } from "@/hooks/use-turnkey-wallet";
import { NATIVE_CHAIN, NATIVE_DECIMALS, type CrosschainSymbol } from "@/lib/cctp/config";
import { ethGasReserve, fetchLifiQuote, type LifiQuote } from "@/lib/lifi/execute";
import { SEND_ASSETS } from "@/lib/send/registry";
import { useColors } from "@/lib/theme/appearance";
import { radius, space } from "@/lib/theme/tokens";
import { ensureChainAddress } from "@/lib/turnkey/accounts";
import { describeTurnkeyError, isUserCancelledError } from "@/lib/turnkey/client";
import { fCurrency, fNumber } from "@/lib/utils/number-format.utils";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

// Cross-chain swaps below this USD value have poor route coverage and a high
// stuck/refund rate (LI.FI's own guidance: ~$5+). Web MIN_SWAP_USD.
const MIN_SWAP_USD = 5;
const QUOTE_STALE_MS = 10 * 60_000; // a built quote carries deadlines (web quote-freshness.ts)
const MATERIAL_DRIFT = 0.01;
// Kept back so the source chain can pay the bridge deposit's costs (web CHAIN_ASSETS.feeReserve).
// ETH is live gas (gas-reserve.ts); BTC ~2k sat miner fee; SOL rent + ATA + fees.
const STATIC_RESERVE: Record<CrosschainSymbol, number> = { BTC: 0.00002, ETH: 0.003, SOL: 0.01 };
const ADDRESS_OF: Record<WalletChain, "stellarAddress" | "bitcoinAddress" | "ethereumAddress" | "solanaAddress"> = {
  stellar: "stellarAddress",
  bitcoin: "bitcoinAddress",
  ethereum: "ethereumAddress",
  solana: "solanaAddress"
};

const toBaseUnits = (amount: number, decimals: number): string => {
  const [w, f = ""] = amount.toFixed(decimals).split(".");
  return (BigInt(w) * BigInt(10) ** BigInt(decimals) + BigInt(f.padEnd(decimals, "0"))).toString();
};
const fromBase = (v: string, decimals: number) => Number(v) / 10 ** decimals;

export function LifiPanel({ from, to, amount, setAmount, fromPill, toPill, onFlip, fiat, onToggleFiat }: { from: CrosschainSymbol; to: CrosschainSymbol; amount: string; setAmount: (v: string) => void; fromPill: React.ReactNode; toPill: React.ReactNode; onFlip: () => void; fiat: boolean; onToggleFiat: () => void }) {
  const c = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useSupabaseAuth();
  const { wallet, refetch: refetchWallet } = useTurnkeyWallet();
  const { portfolioData } = useBackendPortfolio();

  const [quote, setQuote] = React.useState<{ q: LifiQuote; feePercent: number; fetchedAt: number } | null>(null);
  const [quoting, setQuoting] = React.useState(false);
  const [quoteError, setQuoteError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [addingChain, setAddingChain] = React.useState<WalletChain | null>(null);
  const [priceMoved, setPriceMoved] = React.useState(false);
  const [reserve, setReserve] = React.useState<number>(STATIC_RESERVE[from]);

  const fromChain = NATIVE_CHAIN[from];
  const toChain = NATIVE_CHAIN[to];
  const fromAddress = wallet ? wallet[ADDRESS_OF[fromChain]] : null;
  const toAddress = wallet ? wallet[ADDRESS_OF[toChain]] : null;
  const asset = portfolioData.assets.find((a) => a.asset_code === from);
  const balance = Number(asset?.balance ?? 0);
  const price = asset?.usdPrice ?? 0;
  const toPrice = portfolioData.assets.find((a) => a.asset_code === to)?.usdPrice ?? 0;
  const spendable = Math.max(balance - reserve, 0);
  const amountNum = Number(amount.replace(",", "."));
  const amountOk = Number.isFinite(amountNum) && amountNum > 0;
  const insufficient = amountOk && amountNum > spendable + 1e-12;
  const inUsd = amountOk ? amountNum * price : 0;
  const belowMinimum = amountOk && price > 0 && inUsd < MIN_SWAP_USD;

  React.useEffect(() => {
    if (from === "ETH") void ethGasReserve().then(setReserve);
    else setReserve(STATIC_RESERVE[from]);
  }, [from]);

  // Quote: 600ms debounce (web), only while the form is valid — lifi/quote is
  // 30 per 10s per IP and carrier NAT shares one IP across many users.
  const reqRef = React.useRef(0);
  const getQuote = React.useCallback(async () => {
    if (!fromAddress || !toAddress) return null;
    // ROUND_DOWN: rounding a typed amount UP can ask for one wire unit more than the wallet holds.
    const res = await fetchLifiQuote({ fromSymbol: from, toSymbol: to, fromAmount: toBaseUnits(amountNum, NATIVE_DECIMALS[from]), fromAddress, toAddress });
    if (!res.success || !res.quote?.estimate?.toAmount) throw new Error(res.error ?? "No route right now");
    return { q: res.quote, feePercent: typeof res.feePercent === "number" ? res.feePercent : 0, fetchedAt: Date.now() };
  }, [from, to, amountNum, fromAddress, toAddress]);
  React.useEffect(() => {
    if (busy || !amountOk || insufficient || belowMinimum || !fromAddress || !toAddress) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    const id = ++reqRef.current;
    const t = setTimeout(async () => {
      setQuoting(true);
      try {
        const q = await getQuote();
        if (reqRef.current !== id) return;
        setQuote(q);
        setQuoteError(null);
        setPriceMoved(false);
      } catch (e) {
        if (reqRef.current === id) {
          setQuote(null);
          setQuoteError(e instanceof Error ? e.message : "No route right now");
        }
      } finally {
        if (reqRef.current === id) setQuoting(false);
      }
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountNum, amountOk, insufficient, belowMinimum, from, to, fromAddress, toAddress, busy]);

  const toAmount = quote ? fromBase(quote.q.estimate.toAmount, NATIVE_DECIMALS[to]) : null;
  const toAmountMin = quote ? fromBase(quote.q.estimate.toAmountMin, NATIVE_DECIMALS[to]) : null;
  const rate = quote && toAmount && amountOk ? toAmount / amountNum : null;
  const gasUsd = quote ? (quote.q.estimate.gasCosts ?? []).reduce((s, g) => s + (parseFloat(g.amountUSD ?? "0") || 0), 0) : 0;
  const gasShare = inUsd > 0 && gasUsd > 0 ? gasUsd / inUsd : 0;
  const etaMin = quote ? Math.max(1, Math.round(quote.q.estimate.executionDuration / 60)) : null;
  const feeToken = quote && quote.feePercent > 0 && amountOk ? amountNum * quote.feePercent : null;

  const addChain = async (chain: WalletChain) => {
    if (!wallet) return;
    setAddingChain(chain);
    try {
      const updated = await ensureChainAddress(wallet, chain);
      queryClient.setQueryData(turnkeyWalletQueryKey(user?.id), updated);
      await refetchWallet();
    } catch (e) {
      if (!isUserCancelledError(e)) Alert.alert("Couldn’t add the chain", describeTurnkeyError(e));
    } finally {
      setAddingChain(null);
    }
  };

  const run = async () => {
    if (!wallet?.subOrgId || !fromAddress || !toAddress || !quote) return;
    setBusy(true);
    setPriceMoved(false);
    try {
      // A built quote carries deadlines (a Bitcoin one is a Chainflip deposit
      // CHANNEL that expires): re-quote past 10 min; a materially worse output
      // needs a second press (web quote-freshness.ts).
      let live = quote;
      if (Date.now() - quote.fetchedAt >= QUOTE_STALE_MS) {
        const fresh = await getQuote();
        if (!fresh) throw new Error("This quote expired and a new one could not be fetched — nothing was sent. Please try again.");
        setQuote(fresh);
        live = fresh;
        const shown = Number(quote.q.estimate.toAmount);
        const now = Number(fresh.q.estimate.toAmount);
        if (now < shown && (shown - now) / shown > MATERIAL_DRIFT) {
          setPriceMoved(true);
          return;
        }
      }
      const runId = setPendingRun({
        kind: "lifi",
        from,
        to,
        amount: amountNum.toString(),
        quote: live.q,
        feePercent: live.feePercent,
        etaMin: Math.max(1, Math.round(live.q.estimate.executionDuration / 60)),
        toAmount: fromBase(live.q.estimate.toAmount, NATIVE_DECIMALS[to]),
        tool: live.q.tool ?? null
      });
      setAmount("");
      setQuote(null);
      router.push({ pathname: "/swap-run", params: { runId } });
    } catch (e) {
      Alert.alert("Couldn’t start the swap", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // Button state machine — the gates implement lazy wallet setup explicitly (web order).
  let button: { label: string; onPress?: () => void; disabled?: boolean; loading?: boolean };
  if (!fromAddress) button = { label: addingChain === fromChain ? "Adding…" : `Add ${SEND_ASSETS[from].name} to your wallet`, onPress: () => void addChain(fromChain), loading: addingChain === fromChain };
  else if (!toAddress) button = { label: addingChain === toChain ? "Adding…" : `Add ${SEND_ASSETS[to].name} to your wallet`, onPress: () => void addChain(toChain), loading: addingChain === toChain };
  else if (!amountOk) button = { label: "Enter an amount", disabled: true };
  else if (insufficient) button = { label: `Insufficient ${from} balance`, disabled: true };
  else if (gasShare > 0.5) button = { label: "Network fees exceed half this swap — try a larger amount", disabled: true };
  else if (belowMinimum) button = { label: `Minimum swap is $${MIN_SWAP_USD}`, disabled: true };
  else if (busy) button = { label: "Checking the price…", loading: true };
  else if (quoting || !quote) button = { label: quoteError ? "No route right now" : "Fetching quote…", disabled: true };
  else if (priceMoved) button = { label: "Price moved — press to continue", onPress: run };
  else button = { label: "Swap with passkey", onPress: run };

  return (
    <YStack gap={20}>
      <Card padding={12} gap={0}>
        <AmountInput amount={amount} setAmount={setAmount} symbol={from} price={price} spendable={spendable} decimals={NATIVE_DECIMALS[from]} balanceDecimals={from === "SOL" ? 4 : from === "ETH" ? 5 : 8} pill={fromPill} fiat={fiat} onToggleFiat={onToggleFiat} editable={!busy} insufficient={insufficient} note={balance > 0 ? `Keeps ${fNumber(reserve, { maximumFractionDigits: from === "BTC" ? 8 : 5 })} ${from} for fees` : null} />
        <SwapMiddle onFlip={busy ? undefined : onFlip} />
        <ReceiveBox amount={toAmount} symbol={to} price={toPrice} decimals={to === "BTC" ? 8 : to === "ETH" ? 6 : 4} pill={toPill} fiat={fiat} onToggleFiat={onToggleFiat} loading={quoting} qualifier='estimated' />

        {quote ? (
          <YStack paddingHorizontal={4} paddingTop={6} gap={6}>
            {rate ? <XStack justifyContent='space-between'><UiText fontSize={12} color={c.muted}>Rate</UiText><Mono fontSize={12}>1 {from} ≈ {fNumber(rate, { maximumFractionDigits: 6 })} {to}</Mono></XStack> : null}
            {gasUsd > 0 ? <XStack justifyContent='space-between'><UiText fontSize={12} color={c.muted}>Network gas</UiText><Mono fontSize={12} color={gasShare > 0.2 ? c.chips.amber.color : c.ink}>≈{fCurrency(gasUsd)}{inUsd > 0 ? ` (${Math.round(gasShare * 100)}%)` : ""}</Mono></XStack> : null}
            {gasShare > 0.2 && gasShare <= 0.5 ? <UiText fontSize={12} color={c.chips.amber.color}>Network fees eat {Math.round(gasShare * 100)}% of this swap — a larger amount gets a better deal.</UiText> : null}
            {toAmountMin !== null ? <XStack justifyContent='space-between'><UiText fontSize={12} color={c.muted}>Minimum received</UiText><Mono fontSize={12}>{fNumber(toAmountMin, { maximumFractionDigits: 6 })} {to}</Mono></XStack> : null}
            {feeToken !== null ? <XStack justifyContent='space-between'><UiText fontSize={12} color={c.muted}>Normal fee ({+(quote.feePercent * 100).toFixed(2)}%)</UiText><Mono fontSize={12}>−{fNumber(feeToken, { maximumFractionDigits: 6 })} {from}{price > 0 ? ` (${fCurrency(feeToken * price)})` : ""}</Mono></XStack> : null}
            {quote.q.tool ? <XStack justifyContent='space-between'><UiText fontSize={12} color={c.muted}>Route</UiText><Mono fontSize={12}>{quote.q.tool}</Mono></XStack> : null}
            {etaMin !== null ? <XStack justifyContent='space-between'><UiText fontSize={12} color={c.muted}>Estimated time</UiText><Mono fontSize={12}>~{etaMin} min</Mono></XStack> : null}
          </YStack>
        ) : quoteError && amountOk && !insufficient && !belowMinimum ? (
          <UiText fontSize={12} color={c.failed} paddingHorizontal={4}>{quoteError}</UiText>
        ) : null}

        {priceMoved ? (
          <YStack padding={12} borderRadius={radius.input} backgroundColor={c.chips.amber.bg} marginTop={6}>
            <UiText fontSize={13} color={c.chips.amber.color} lineHeight={19}>The price moved while this quote was open — the amount shown is updated. Press again to continue.</UiText>
          </YStack>
        ) : null}

        <YStack marginTop={6} gap={8}>
          <PrimaryButton label={button.label} onPress={button.onPress} disabled={button.disabled} loading={button.loading} />
          <UiText fontSize={12} color={c.faint} textAlign='center'>{to} is delivered to your own Normal wallet address.</UiText>
        </YStack>
      </Card>
    </YStack>
  );
}
