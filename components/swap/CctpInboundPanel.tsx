// Cross-chain panel, INBOUND: ETH / SOL → USDC on Stellar via LI.FI + Circle
// CCTP (lib/cctp/engine.ts runInboundSwap). One passkey for the source swap;
// the Base burn is autopilot (0) or passkey (1–2); the relayer mints on
// Stellar. BTC as a source needs the local-sighash signer — not yet on mobile.

import React from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Input, XStack, YStack } from "tamagui";

import { Card, Mono, PillButton, PrimaryButton, Skeleton, UiText } from "@/components/home/primitives";
import { setPendingRun } from "@/lib/swap/run-store";
import { useBackendPortfolio } from "@/hooks/use-backend-portfolio";
import { useStellarAccountProbe } from "@/hooks/use-savings";
import { turnkeyWalletQueryKey, useTurnkeyWallet, type WalletChain } from "@/hooks/use-turnkey-wallet";
import { NATIVE_CHAIN, NATIVE_DECIMALS, type CrosschainSymbol } from "@/lib/cctp/config";
import { ethGasReserve, fetchLifiQuote, type LifiQuote } from "@/lib/lifi/execute";
import { SEND_ASSETS } from "@/lib/send/registry";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";
import { ensureChainAddress } from "@/lib/turnkey/accounts";
import { describeTurnkeyError, isUserCancelledError } from "@/lib/turnkey/client";
import { fCurrency, fNumber } from "@/lib/utils/number-format.utils";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

const MIN_USD = 10;
const QUOTE_STALE_MS = 10 * 60_000; // a built LI.FI quote carries deadlines (web quote-freshness.ts)
const MATERIAL_DRIFT = 0.01;
const SOL_RESERVE = 0.01; // fees + ATA rent (web)
const ADDRESS_OF: Record<WalletChain, "stellarAddress" | "bitcoinAddress" | "ethereumAddress" | "solanaAddress"> = {
  stellar: "stellarAddress",
  bitcoin: "bitcoinAddress",
  ethereum: "ethereumAddress",
  solana: "solanaAddress"
};

// MAX must round DOWN (web: toFixed(min(decimals, 8), ROUND_DOWN)) — toFixed
// rounds to nearest, so a max that landed above spendable read "insufficient".
const floorTo = (v: number, decimals: number): string => {
  const f = 10 ** decimals;
  return (Math.floor(v * f) / f).toFixed(decimals).replace(/\.?0+$/, "") || "0";
};

const toBaseUnits = (amount: number, decimals: number): string => {
  const [w, f = ""] = amount.toFixed(decimals).split(".");
  return (BigInt(w) * BigInt(10) ** BigInt(decimals) + BigInt(f.padEnd(decimals, "0"))).toString();
};

export function CctpInboundPanel({ from, amount, setAmount, fromPill, toPill }: { from: CrosschainSymbol; amount: string; setAmount: (v: string) => void; fromPill: React.ReactNode; toPill: React.ReactNode }) {
  const c = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useSupabaseAuth();
  const { wallet, refetch: refetchWallet } = useTurnkeyWallet();
  const { portfolioData } = useBackendPortfolio();
  const probe = useStellarAccountProbe(wallet?.stellarAddress, false);

  const [quote, setQuote] = React.useState<{ q: LifiQuote; feePercent: number; fetchedAt: number } | null>(null);
  const [quoting, setQuoting] = React.useState(false);
  const [quoteError, setQuoteError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [addingChain, setAddingChain] = React.useState<WalletChain | null>(null);
  const [notice, setNotice] = React.useState<{ text: string; tone: "amber" | "blue"; affordable?: string } | null>(null);
  const [priceMoved, setPriceMoved] = React.useState(false);
  const [reserve, setReserve] = React.useState<number>(from === "ETH" ? 0.003 : SOL_RESERVE);

  const stellarAddress = wallet?.stellarAddress ?? null;
  const evmAddress = wallet?.ethereumAddress ?? null;
  const fromChain = NATIVE_CHAIN[from];
  const fromAddress = wallet ? wallet[ADDRESS_OF[fromChain]] : null;
  const asset = portfolioData.assets.find((a) => a.asset_code === from);
  const balance = Number(asset?.balance ?? 0);
  const price = asset?.usdPrice ?? 0;
  const spendable = Math.max(balance - reserve, 0);
  const amountNum = Number(amount.replace(",", "."));
  const amountOk = Number.isFinite(amountNum) && amountNum > 0;
  const insufficient = amountOk && amountNum > spendable + 1e-12;
  const needsActivation = probe.data?.exists === false;
  const needsTrustline = probe.data?.exists === true && !probe.data.hasUsdcTrustline;
  const btcSource = from === "BTC";

  React.useEffect(() => {
    if (from === "ETH") void ethGasReserve().then(setReserve);
    else setReserve(SOL_RESERVE);
  }, [from]);

  // Quote: LI.FI native → USDC on Base, delivered to the user's OWN Base address.
  const reqRef = React.useRef(0);
  const getQuote = React.useCallback(async () => {
    if (!fromAddress || !evmAddress) return null;
    const res = await fetchLifiQuote({ fromSymbol: from, toSymbol: "USDC_BASE", fromAmount: toBaseUnits(amountNum, NATIVE_DECIMALS[from]), fromAddress, toAddress: evmAddress });
    if (!res.success || !res.quote?.estimate?.toAmountMin) throw new Error(res.error ?? "No route right now");
    return { q: res.quote, feePercent: typeof res.feePercent === "number" ? res.feePercent : 0, fetchedAt: Date.now() };
  }, [from, amountNum, fromAddress, evmAddress]);
  React.useEffect(() => {
    if (busy || btcSource || !amountOk || insufficient || !fromAddress || !evmAddress) {
      setQuote(null);
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
  }, [amountNum, amountOk, insufficient, from, fromAddress, evmAddress, busy]);

  const usdcOut = quote ? Number(quote.q.estimate.toAmountMin) / 1e6 : null;
  const gasUsd = quote ? (quote.q.estimate.gasCosts ?? []).reduce((s, g) => s + (parseFloat(g.amountUSD ?? "0") || 0), 0) : 0;
  const inUsd = amountOk ? amountNum * price : 0;
  const gasShare = inUsd > 0 ? gasUsd / inUsd : 0;
  const tooSmall = usdcOut !== null && usdcOut < MIN_USD;
  const etaMin = quote ? Math.max(1, Math.round(quote.q.estimate.executionDuration / 60)) + 20 : null; // + Base finality

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
    if (!wallet?.subOrgId || !stellarAddress || !evmAddress || !fromAddress || !quote) return;
    setBusy(true);
    setPriceMoved(false);
    try {
      // A built quote carries deadlines: re-quote past 10 min; a materially
      // worse output needs a second press (web quote-freshness.ts).
      let live = quote;
      if (Date.now() - quote.fetchedAt >= QUOTE_STALE_MS) {
        const fresh = await getQuote();
        if (!fresh) throw new Error("No route right now");
        setQuote(fresh);
        live = fresh;
        const shown = Number(quote.q.estimate.toAmountMin);
        const now = Number(fresh.q.estimate.toAmountMin);
        if (now < shown && (shown - now) / shown > MATERIAL_DRIFT) {
          setPriceMoved(true);
          return;
        }
      }
      const runId = setPendingRun({ kind: "cctp-in", from, to: "USDC", amount: amountNum.toString(), quote: live.q, feePercent: live.feePercent, etaMin, usdcOut: Number(live.q.estimate.toAmountMin) / 1e6 });
      setAmount("");
      setQuote(null);
      router.push({ pathname: "/swap-run", params: { runId } });
    } catch (e) {
      setNotice({ text: e instanceof Error ? e.message : String(e), tone: "amber" });
    } finally {
      setBusy(false);
    }
  };

  let button: { label: string; onPress?: () => void; disabled?: boolean; loading?: boolean };
  if (btcSource) button = { label: "BTC swaps arrive soon", disabled: true };
  else if (!stellarAddress) button = { label: "Stellar wallet required", disabled: true };
  else if (needsActivation) button = { label: "Activate your Stellar account first", onPress: () => router.push("/(tabs)/savings") };
  else if (needsTrustline) button = { label: "Add USDC trustline first", onPress: () => router.push("/(tabs)/savings") };
  else if (!fromAddress) button = { label: addingChain === fromChain ? "Adding…" : `Add ${SEND_ASSETS[from].name} to your wallet`, onPress: () => void addChain(fromChain), loading: addingChain === fromChain };
  else if (!evmAddress) button = { label: addingChain === "ethereum" ? "Adding…" : "Add Ethereum to your wallet", onPress: () => void addChain("ethereum"), loading: addingChain === "ethereum" };
  else if (!amountOk) button = { label: "Enter an amount", disabled: true };
  else if (insufficient) button = { label: `Insufficient ${from} balance`, disabled: true };
  else if (busy) button = { label: "Checking the price…", loading: true };
  else if (quoting || !quote) button = { label: quoteError ? "No route right now" : "Fetching quote…", disabled: true };
  else if (gasShare > 0.5) button = { label: "Network fees exceed half this swap — try a larger amount", disabled: true };
  else if (tooSmall) button = { label: `Minimum swap is $${MIN_USD}`, disabled: true };
  else if (priceMoved) button = { label: "Price moved — press to continue", onPress: run };
  else button = { label: "Swap with passkey", onPress: run };

  return (
    <YStack gap={20}>
      <Card padding={12} gap={8}>
        <YStack backgroundColor={c.inputBg} borderRadius={radius.input} padding={14} gap={10}>
          <XStack justifyContent='space-between' alignItems='center'>
            <UiText fontSize={12} color={c.muted}>You pay</UiText>
            <XStack alignItems='center' gap={8}>
              <Mono fontSize={11} color={insufficient ? c.failed : c.muted}>{fNumber(spendable, { maximumFractionDigits: from === "ETH" ? 5 : 4 })} {from}</Mono>
              <PillButton label='Max' onPress={() => setAmount(floorTo(spendable, Math.min(NATIVE_DECIMALS[from], 8)))} />
            </XStack>
          </XStack>
          <XStack alignItems='center' justifyContent='space-between' gap={10}>
            <Input flex={1} unstyled backgroundColor='transparent' borderWidth={0} color={c.ink} placeholderTextColor={c.faint} fontFamily='$mono' fontSize={28} letterSpacing={tracking(28)} placeholder='0.00' keyboardType='decimal-pad' value={amount} onChangeText={setAmount} editable={!busy} />
            {fromPill}
          </XStack>
          {!btcSource && balance > 0 ? (
            <UiText fontSize={11} color={c.faint} fontFamily='$mono'>Keeps {fNumber(reserve, { maximumFractionDigits: 5 })} {from} for network fees</UiText>
          ) : null}
        </YStack>
        <YStack backgroundColor={c.inputBg} borderRadius={radius.input} padding={14} gap={10}>
          <UiText fontSize={12} color={c.muted}>You receive (minimum)</UiText>
          <XStack alignItems='center' justifyContent='space-between' gap={10}>
            {quoting && !quote ? <Skeleton width={120} height={30} /> : (
              <Mono fontSize={28} letterSpacing={tracking(28)} color={usdcOut !== null ? c.ink : c.faint} flex={1} numberOfLines={1}>
                {usdcOut !== null ? fNumber(usdcOut, { maximumFractionDigits: 2 }) : "0.00"}
              </Mono>
            )}
            {toPill}
          </XStack>
        </YStack>

        {quote ? (
          <YStack paddingHorizontal={4} paddingTop={6} gap={6}>
            <XStack justifyContent='space-between'><UiText fontSize={12} color={c.muted}>Route</UiText><Mono fontSize={12}>{from} → USDC (Base) → Stellar</Mono></XStack>
            <XStack justifyContent='space-between'><UiText fontSize={12} color={c.muted}>Bridge (Circle CCTP)</UiText><Mono fontSize={12}>Free</Mono></XStack>
            <XStack justifyContent='space-between'><UiText fontSize={12} color={c.muted}>Network gas</UiText><Mono fontSize={12} color={gasShare > 0.2 ? c.chips.amber.color : c.ink}>≈{fCurrency(gasUsd)}{inUsd > 0 ? ` (${Math.round(gasShare * 100)}%)` : ""}</Mono></XStack>
            {gasShare > 0.2 && gasShare <= 0.5 ? <UiText fontSize={12} color={c.chips.amber.color}>Network fees eat {Math.round(gasShare * 100)}% of this swap — a larger amount gets a better deal.</UiText> : null}
            <XStack justifyContent='space-between'><UiText fontSize={12} color={c.muted}>Normal fee ({+(quote.feePercent * 100).toFixed(2)}%)</UiText><Mono fontSize={12}>−{(amountNum * quote.feePercent).toFixed(6)} {from}</Mono></XStack>
            <XStack justifyContent='space-between'><UiText fontSize={12} color={c.muted}>Estimated time</UiText><Mono fontSize={12}>~{etaMin} min</Mono></XStack>
          </YStack>
        ) : quoteError && amountOk && !insufficient ? (
          <UiText fontSize={12} color={c.failed} paddingHorizontal={4}>{quoteError}</UiText>
        ) : null}

        {btcSource ? (
          <YStack padding={12} borderRadius={radius.input} backgroundColor={c.chips.blue.bg} marginTop={6}>
            <UiText fontSize={13} color={c.ink2} lineHeight={19}>Bitcoin → USDC arrives on mobile soon. It works on the web app today.</UiText>
          </YStack>
        ) : null}
        {needsActivation || needsTrustline ? (
          <YStack padding={12} borderRadius={radius.input} backgroundColor={c.chips.blue.bg} marginTop={6}>
            <UiText fontSize={13} color={c.ink2} lineHeight={19}>{needsActivation ? "USDC is delivered to your Stellar account — it needs a little XLM to activate first (Savings → setup)." : "USDC is delivered to your Stellar account — add the USDC trustline first (Savings → setup)."}</UiText>
          </YStack>
        ) : null}
        {priceMoved ? (
          <YStack padding={12} borderRadius={radius.input} backgroundColor={c.chips.amber.bg} marginTop={6}>
            <UiText fontSize={13} color={c.chips.amber.color} lineHeight={19}>The price moved while this quote was open — the amount shown is updated. Press again to continue.</UiText>
          </YStack>
        ) : null}
        {notice ? (
          <YStack padding={12} borderRadius={radius.input} backgroundColor={notice.tone === "amber" ? c.chips.amber.bg : c.chips.blue.bg} marginTop={6} gap={8}>
            <UiText fontSize={13} color={notice.tone === "amber" ? c.chips.amber.color : c.ink2} lineHeight={19}>{notice.text}</UiText>
            {notice.affordable ? <PillButton label={`Use ${notice.affordable} ${from}`} onPress={() => { setAmount(notice.affordable!); setNotice(null); }} /> : null}
          </YStack>
        ) : null}

        <YStack marginTop={6}>
          <PrimaryButton label={button.label} onPress={button.onPress} disabled={button.disabled} loading={button.loading} />
        </YStack>
      </Card>

    </YStack>
  );
}
