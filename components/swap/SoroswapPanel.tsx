// Stellar-native XLM ↔ USDC via Soroswap (lib/swap/soroswap.ts) — the panel
// the Swap tab renders for a same-group Stellar pair. The shell owns the
// pickers; this owns quote, gates, execution and the step list (web engine
// contract). Gates mirror web use-soroswap-engine.tsx in the same order:
// activation → trustline → amount → balance → Soroban fee → quote.

import React from "react";
import { Alert } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { XStack, YStack } from "tamagui";

import { Card, Mono, PrimaryButton, UiText } from "@/components/home/primitives";
import { AmountInput, ReceiveBox, SwapMiddle } from "@/components/swap/AmountInput";
import { ReceiveSheet } from "@/components/home/ReceiveSheet";
import { useBackendPortfolio } from "@/hooks/use-backend-portfolio";
import { useSavingsPosition, useStellarAccountProbe } from "@/hooks/use-savings";
import { turnkeyWalletQueryKey, useTurnkeyWallet, walletAddresses } from "@/hooks/use-turnkey-wallet";
import { provisionChain } from "@/lib/turnkey/provision";
import { refreshAfterStellarAction } from "@/lib/data/after-action";
import { addUsdcTrustline } from "@/lib/savings/engine";
import { canPaySorobanFee, maxXlmForSorobanSwap, spendableXlmForOutflow } from "@/lib/stellar/send";
import { QUOTE_DRIFT_TOLERANCE, QUOTE_MAX_AGE_MS, getSwapQuote, type SwapQuote, type SwapSymbol } from "@/lib/swap/soroswap";
import { setPendingRun } from "@/lib/swap/run-store";
import { useColors } from "@/lib/theme/appearance";
import { radius, space } from "@/lib/theme/tokens";
import { describeTurnkeyError, isUserCancelledError } from "@/lib/turnkey/client";
import { ensureDeviceReady } from "@/lib/turnkey/device-check";
import { useDeviceReady } from "@/lib/turnkey/device-ready";
import { fCurrency, fNumber } from "@/lib/utils/number-format.utils";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

// Web allows dust swaps where the Soroban fee dwarfs the trade; a small floor.
const MIN_SWAP_USD = 1;

export interface SwapPanelProps {
  amount: string;
  setAmount: (v: string) => void;
  /** The shell's asset pills (open the picker). */
  fromPill: React.ReactNode;
  toPill: React.ReactNode;
  onFlip?: () => void;
  fiat: boolean;
  onToggleFiat: () => void;
}

export function SoroswapPanel({ from, to, amount, setAmount, fromPill, toPill, onFlip, fiat, onToggleFiat }: SwapPanelProps & { from: SwapSymbol; to: SwapSymbol }) {
  const c = useColors();
  const isFocused = useIsFocused();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useSupabaseAuth();
  const { wallet, refetch: refetchWallet } = useTurnkeyWallet();
  const address = wallet?.stellarAddress ?? null;
  const { ready: deviceReady } = useDeviceReady(wallet?.subOrgId);
  const { portfolioData } = useBackendPortfolio();
  const { hasActiveSavings } = useSavingsPosition(address);

  const [quote, setQuote] = React.useState<SwapQuote | null>(null);
  const [quoteError, setQuoteError] = React.useState<string | null>(null);
  const [quoting, setQuoting] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [receiveOpen, setReceiveOpen] = React.useState(false);
  const [addingTrustline, setAddingTrustline] = React.useState(false);
  const [priceMoved, setPriceMoved] = React.useState(false);
  // Lazy creation: no Stellar address yet (or no wallet at all) → one passkey.
  const [addingStellar, setAddingStellar] = React.useState(false);
  const addStellar = async () => {
    if (!user) return;
    setAddingStellar(true);
    try {
      const updated = await provisionChain({ user, wallet, chain: "stellar" });
      queryClient.setQueryData(turnkeyWalletQueryKey(user.id), updated);
      await refetchWallet();
    } catch (e) {
      if (!isUserCancelledError(e)) Alert.alert("Couldn’t add Stellar", describeTurnkeyError(e));
    } finally {
      setAddingStellar(false);
    }
  };

  // Account state (Horizon): activation, trustline, XLM for the Soroban fee.
  // Watched only while a gate is open and this tab is on screen.
  const [watch, setWatch] = React.useState(false);
  const probe = useStellarAccountProbe(address, watch && isFocused);
  const accountExists = probe.data?.exists ?? null;
  const hasTrustline = probe.data?.hasUsdcTrustline ?? false;
  const xlmBalance = probe.data?.xlmBalance ?? 0;
  const subentries = probe.data?.subentryCount ?? 1;
  const needsActivation = to === "USDC" && accountExists === false;
  const needsTrustline = to === "USDC" && accountExists === true && !hasTrustline;
  React.useEffect(() => {
    setWatch(needsActivation || needsTrustline);
  }, [needsActivation, needsTrustline]);

  const amountNum = Number(amount.replace(",", "."));
  const amountOk = Number.isFinite(amountNum) && amountNum > 0;
  const price = (sym: SwapSymbol) => portfolioData.assets.find((a) => a.asset_code === sym)?.usdPrice ?? 0;
  // XLM's spendable already holds back the reserve, the classic fee and the
  // savings buffer (#67); the Soroban fee this swap pays comes off in MAX.
  const spendableXlm = spendableXlmForOutflow(xlmBalance, subentries, hasActiveSavings);
  const fromBalance = from === "XLM" ? spendableXlm : probe.data?.usdcBalance ?? Number(portfolioData.assets.find((a) => a.asset_code === "USDC")?.balance ?? 0);
  const insufficient = amountOk && amountNum > fromBalance + 1e-7;
  const xlmSpent = from === "XLM" ? amountNum : 0;
  const cannotPayFee = amountOk && accountExists === true && !canPaySorobanFee(xlmBalance, subentries, xlmSpent);
  // Name the shortfall: a gate must offer the action that clears it.
  const feeShortfall = Math.max(0.5 + (2 + subentries) * 0.5 - (xlmBalance - xlmSpent), 0);
  const tooSmall = amountOk && price(from) > 0 && amountNum * price(from) < MIN_SWAP_USD;
  // What MAX holds back on an XLM source (reserve, fees, savings buffer).
  const xlmHoldback = Math.max(xlmBalance - maxXlmForSorobanSwap(spendableXlm), 0);

  // Quote: 500ms debounce (web), one in flight, stale responses dropped, and
  // only while the tab is on screen — the public quote route is 30/10s per IP
  // and phones behind carrier NAT share one.
  const requestRef = React.useRef(0);
  React.useEffect(() => {
    if (!isFocused || busy) return;
    if (!amountOk) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    const id = ++requestRef.current;
    const t = setTimeout(async () => {
      setQuoting(true);
      try {
        const q = await getSwapQuote(from, to, amountNum);
        if (requestRef.current !== id) return;
        setQuote(q);
        setQuoteError(null);
        setPriceMoved(false);
      } catch (e) {
        if (requestRef.current !== id) return;
        setQuote(null);
        setQuoteError(e instanceof Error ? e.message : "Failed to get quote");
      } finally {
        if (requestRef.current === id) setQuoting(false);
      }
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountNum, amountOk, from, to, isFocused, busy]);

  const flip = () => {
    if (busy) return;
    setQuote(null);
    onFlip?.();
  };

  const rate = quote && parseFloat(quote.amountIn) > 0 ? (parseFloat(quote.amountOut) / (parseFloat(quote.amountIn) - parseFloat(quote.fee))).toFixed(6) : null;

  const gate = async (): Promise<boolean> => {
    if (!wallet?.subOrgId || !address) return false;
    const g = await ensureDeviceReady(wallet.subOrgId, address, deviceReady);
    if (g.outcome === "needs-setup") {
      Alert.alert("Set up this phone", "Add this phone's passkey in Settings → Security first.");
      return false;
    }
    if (g.outcome === "cancelled") return false;
    if (g.outcome === "failed") {
      Alert.alert("Couldn’t verify this phone", describeTurnkeyError(g.error));
      return false;
    }
    return true;
  };

  const handleAddTrustline = async () => {
    if (!wallet?.subOrgId || !address) return;
    setAddingTrustline(true);
    try {
      if (!(await gate())) return;
      await addUsdcTrustline({ subOrgId: wallet.subOrgId, address });
      await probe.refetch();
      void refreshAfterStellarAction(queryClient, { userId: user?.id, stellarAddress: address });
    } catch (e) {
      if (!isUserCancelledError(e)) Alert.alert("Couldn’t add the trustline", e instanceof Error ? e.message : describeTurnkeyError(e));
    } finally {
      setAddingTrustline(false);
    }
  };

  // Hand the run to the swap-run page (all steps up front, explicit Start).
  const run = async () => {
    if (!quote || !wallet?.subOrgId || !address) return;
    setBusy(true);
    setPriceMoved(false);
    try {
      // A quote older than 45s is re-fetched; a >1% worse price needs a second press.
      let live = quote;
      if (Date.now() - quote.fetchedAt > QUOTE_MAX_AGE_MS) {
        live = await getSwapQuote(from, to, amountNum);
        setQuote(live);
        if (parseFloat(live.amountOut) < parseFloat(quote.amountOut) * (1 - QUOTE_DRIFT_TOLERANCE)) {
          setPriceMoved(true);
          return;
        }
      }
      const runId = setPendingRun({ kind: "soroswap", from, to, quote: live, amount: amountNum.toString() });
      setAmount("");
      setQuote(null);
      router.push({ pathname: "/swap-run", params: { runId } });
    } finally {
      setBusy(false);
    }
  };

  // Button (web order).
  let button: { label: string; onPress?: () => void; disabled?: boolean; loading?: boolean };
  if (!address) button = { label: addingStellar ? "Confirm with your passkey…" : "Add Stellar to your wallet", onPress: () => void addStellar(), loading: addingStellar };
  else if (needsActivation) button = { label: "Add XLM to activate", onPress: () => setReceiveOpen(true) };
  else if (needsTrustline) button = { label: addingTrustline ? "Adding trustline…" : "Add USDC trustline", onPress: handleAddTrustline, loading: addingTrustline };
  else if (!amountOk) button = { label: "Enter an amount", disabled: true };
  else if (insufficient) button = { label: "Insufficient balance", disabled: true };
  else if (cannotPayFee) button = { label: "Receive XLM for the network fee", onPress: () => setReceiveOpen(true) };
  else if (tooSmall) button = { label: `Minimum swap is about $${MIN_SWAP_USD}`, disabled: true };
  else if (priceMoved) button = { label: "Price moved — press to continue", onPress: run };
  else if (busy) button = { label: "Checking the price…", loading: true };
  else if (quoting || !quote) button = { label: quoteError ? "Quote unavailable" : "Fetching quote…", disabled: true };
  else button = { label: "Swap with passkey", onPress: run };

  return (
    <>
        <YStack gap={space.section}>
          <Card padding={12} gap={0}>
            <AmountInput
              amount={amount}
              setAmount={setAmount}
              symbol={from}
              price={from === "USDC" ? price("USDC") || 1 : price(from)}
              spendable={from === "XLM" ? maxXlmForSorobanSwap(spendableXlm) : fromBalance}
              decimals={7}
              balanceDecimals={from === "XLM" ? 4 : 2}
              pill={fromPill}
              fiat={fiat}
              onToggleFiat={onToggleFiat}
              editable={!busy}
              insufficient={insufficient}
              note={from === "XLM" && probe.data?.exists && xlmHoldback > 0 ? `Keeps ${fNumber(xlmHoldback, { maximumFractionDigits: 2 })} XLM for the network reserve${hasActiveSavings ? " & savings fees" : ""}` : null}
              balanceText={probe.data || from === "USDC" ? undefined : "…"}
            />
            <SwapMiddle onFlip={flip} />
            <ReceiveBox amount={quote ? parseFloat(quote.amountOut) || 0 : null} symbol={to} price={to === "USDC" ? price("USDC") || 1 : price(to)} decimals={to === "XLM" ? 4 : 2} pill={toPill} fiat={fiat} onToggleFiat={onToggleFiat} loading={quoting} />

            {quote ? (
              <YStack paddingHorizontal={4} paddingTop={6} gap={6}>
                {rate ? (
                  <XStack justifyContent='space-between'><UiText fontSize={12} color={c.muted}>Rate</UiText><Mono fontSize={12}>1 {from} = {rate} {to}</Mono></XStack>
                ) : null}
                <XStack justifyContent='space-between'>
                  <UiText fontSize={12} color={c.muted}>Normal fee (0.5%)</UiText>
                  <Mono fontSize={12}>−{parseFloat(quote.fee).toFixed(4)} {from}{price(from) ? ` (${fCurrency(parseFloat(quote.fee) * price(from))})` : ""}</Mono>
                </XStack>
                <XStack justifyContent='space-between'><UiText fontSize={12} color={c.muted}>Minimum received (1% slippage)</UiText><Mono fontSize={12}>{fNumber(parseFloat(quote.minAmountOut), { maximumFractionDigits: 4 })} {to}</Mono></XStack>
              </YStack>
            ) : quoteError && amountOk ? (
              <UiText fontSize={12} color={c.failed} paddingHorizontal={4}>{quoteError}</UiText>
            ) : null}

            {needsActivation || needsTrustline || (cannotPayFee && !needsActivation) || priceMoved ? (
              <YStack padding={12} borderRadius={radius.input} backgroundColor={priceMoved ? c.chips.amber.bg : c.chips.blue.bg} marginTop={6}>
                <UiText fontSize={13} color={priceMoved ? c.chips.amber.color : c.ink2} lineHeight={19}>
                  {priceMoved
                    ? "The price moved while this quote was open — the amount shown is updated. Press again to continue."
                    : needsActivation
                      ? "Your Stellar account activates once it receives at least 1 XLM — then the USDC trustline can be added."
                      : needsTrustline
                        ? "A USDC trustline is required before swapping to USDC. One passkey confirmation, a tiny network fee."
                        : `Swaps pay their network fee in XLM. Receive about ${fNumber(feeShortfall + 0.1, { maximumFractionDigits: 2 })} more XLM to cover it.`}
                </UiText>
              </YStack>
            ) : null}

            <YStack marginTop={6}>
              <PrimaryButton label={button.label} onPress={button.onPress} disabled={button.disabled} loading={button.loading} />
            </YStack>
          </Card>

        </YStack>

      <ReceiveSheet open={receiveOpen} addresses={walletAddresses(wallet)} initialChain='stellar' onClose={() => setReceiveOpen(false)} />
    </>
  );
}
