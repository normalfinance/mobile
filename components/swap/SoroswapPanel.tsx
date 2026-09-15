// Stellar-native XLM ↔ USDC via Soroswap (lib/swap/soroswap.ts) — the panel
// the Swap tab renders for a same-group Stellar pair. The shell owns the
// pickers; this owns quote, gates, execution and the step list (web engine
// contract). Gates mirror web use-soroswap-engine.tsx in the same order:
// activation → trustline → amount → balance → Soroban fee → quote.

import React from "react";
import { Alert, Linking } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Input, XStack, YStack } from "tamagui";
import { ArrowDownUp, Check } from "lucide-react-native";

import { Card, IconBox, Mono, PillButton, PrimaryButton, SecondaryButton, Skeleton, UiText } from "@/components/home/primitives";
import { ReceiveSheet } from "@/components/home/ReceiveSheet";
import { StepList, type Step } from "@/components/savings/StepList";
import { useBackendPortfolio } from "@/hooks/use-backend-portfolio";
import { useSavingsPosition, useStellarAccountProbe } from "@/hooks/use-savings";
import { useTurnkeyWallet, walletAddresses } from "@/hooks/use-turnkey-wallet";
import { refreshAfterStellarAction } from "@/lib/data/after-action";
import { addUsdcTrustline } from "@/lib/savings/engine";
import { canPaySorobanFee, maxXlmForSorobanSwap, spendableXlmForOutflow } from "@/lib/stellar/send";
import {
  QUOTE_DRIFT_TOLERANCE,
  QUOTE_MAX_AGE_MS,
  executeSoroswap,
  getSwapQuote,
  type SwapQuote,
  type SwapStage,
  type SwapSymbol
} from "@/lib/swap/soroswap";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";
import { describeTurnkeyError, isUserCancelledError } from "@/lib/turnkey/client";
import { ensureDeviceReady } from "@/lib/turnkey/device-check";
import { useDeviceReady } from "@/lib/turnkey/device-ready";
import { fCurrency, fNumber, shortenAddress } from "@/lib/utils/number-format.utils";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

type UiStage = SwapStage | "refetch" | "done" | null;

const truncate7 = (v: number) => (Math.floor(v * 1e7) / 1e7).toFixed(7).replace(/\.?0+$/, "");
// Web allows dust swaps where the Soroban fee dwarfs the trade; a small floor.
const MIN_SWAP_USD = 1;

export interface SwapPanelProps {
  amount: string;
  setAmount: (v: string) => void;
  /** The shell's asset pills (open the picker). */
  fromPill: React.ReactNode;
  toPill: React.ReactNode;
  onFlip?: () => void;
}

export function SoroswapPanel({ from, to, amount, setAmount, fromPill, toPill, onFlip }: SwapPanelProps & { from: SwapSymbol; to: SwapSymbol }) {
  const c = useColors();
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const { user } = useSupabaseAuth();
  const { wallet } = useTurnkeyWallet();
  const address = wallet?.stellarAddress ?? null;
  const { ready: deviceReady } = useDeviceReady(wallet?.subOrgId);
  const { portfolioData } = useBackendPortfolio();
  const { hasActiveSavings } = useSavingsPosition(address);

  const [quote, setQuote] = React.useState<SwapQuote | null>(null);
  const [quoteError, setQuoteError] = React.useState<string | null>(null);
  const [quoting, setQuoting] = React.useState(false);
  const [stage, setStage] = React.useState<UiStage>(null);
  const [embedded, setEmbedded] = React.useState(false);
  const [doneHash, setDoneHash] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [receiveOpen, setReceiveOpen] = React.useState(false);
  const [addingTrustline, setAddingTrustline] = React.useState(false);
  const [priceMoved, setPriceMoved] = React.useState(false);
  const [degradedAfterSign, setDegradedAfterSign] = React.useState(false);

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
  const useMax = () => setAmount(truncate7(from === "XLM" ? maxXlmForSorobanSwap(spendableXlm) : fromBalance));

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

  const tick = (s: UiStage) => {
    setStage(s);
    if (s && s !== "degraded") void Haptics.selectionAsync().catch(() => undefined);
  };

  const run = async () => {
    if (!quote || !wallet?.subOrgId || !address) return;
    setBusy(true);
    setDoneHash(null);
    setPriceMoved(false);
    setDegradedAfterSign(false);
    try {
      // A quote older than 45s is re-fetched; if the price moved >1% against
      // the user, show the new number and ask for a second press (web's LI.FI
      // engine does this; its Soroswap path signs a rebuilt quote unchecked).
      let live = quote;
      if (Date.now() - quote.fetchedAt > QUOTE_MAX_AGE_MS) {
        live = await getSwapQuote(from, to, amountNum);
        setQuote(live);
        if (parseFloat(live.amountOut) < parseFloat(quote.amountOut) * (1 - QUOTE_DRIFT_TOLERANCE)) {
          setPriceMoved(true);
          return;
        }
      }
      setEmbedded(live.embedded);
      if (!(await gate())) return;
      let signedOnce = false;
      const hash = await executeSoroswap({
        quote: live,
        subOrgId: wallet.subOrgId,
        address,
        onStage: (s) => {
          if (s === "sign-swap") signedOnce = true;
          if (s === "degraded") {
            setEmbedded(false);
            // The server refused the one-signature build AFTER a signature:
            // that signature is discarded; two more confirmations follow.
            if (signedOnce) setDegradedAfterSign(true);
          }
          if (s === "sign-fee") setEmbedded(false);
          tick(s);
        }
      });
      // Feed row exists already (written before broadcast); balances are
      // gated: Done only after the portfolio converged on BOTH sides of the
      // pair (refresh=1 loop), capped at 15s (web #62/#66).
      tick("refetch");
      await Promise.race([
        refreshAfterStellarAction(queryClient, { userId: user?.id, stellarAddress: address, expectMove: [from, to] }),
        new Promise((r) => setTimeout(r, 15_000))
      ]);
      setDoneHash(hash);
      tick("done");
      setAmount("");
      setQuote(null);
    } catch (e) {
      setStage(null);
      if (isUserCancelledError(e)) Alert.alert("Cancelled", "Nothing was submitted and nothing was charged.");
      else Alert.alert("Swap failed", e instanceof Error ? e.message : describeTurnkeyError(e));
    } finally {
      setBusy(false);
    }
  };

  const twoSignatures = quote ? !quote.embedded || !embedded : false;
  const steps: Step[] = [
    { id: "build", label: "Preparing the swap", sub: "Building your transaction" },
    {
      id: "sign",
      label: "Confirm with passkey",
      sub: degradedAfterSign
        ? "The one-signature route was refused — two more confirmations: the swap, then the fee"
        : stage === "sign-fee"
          ? "Now the Normal fee · 2 of 2"
          : twoSignatures
            ? "Two confirmations: the swap, then the Normal fee"
            : "One confirmation — the fee is inside the swap"
    },
    { id: "submit", label: "Submitting to Stellar", sub: "Broadcasting — usually a few seconds" },
    { id: "refetch", label: "Updating balances", sub: "Waiting until your wallet shows the result" }
  ];
  const activeId = stage === "sign-swap" || stage === "sign-fee" ? "sign" : stage === "degraded" ? "build" : stage === "done" ? null : stage;

  // Button (web order).
  let button: { label: string; onPress?: () => void; disabled?: boolean; loading?: boolean };
  if (!address) button = { label: "Stellar wallet required", disabled: true };
  else if (needsActivation) button = { label: "Add XLM to activate", onPress: () => setReceiveOpen(true) };
  else if (needsTrustline) button = { label: addingTrustline ? "Adding trustline…" : "Add USDC trustline", onPress: handleAddTrustline, loading: addingTrustline };
  else if (!amountOk) button = { label: "Enter an amount", disabled: true };
  else if (insufficient) button = { label: "Insufficient balance", disabled: true };
  else if (cannotPayFee) button = { label: "Receive XLM for the network fee", onPress: () => setReceiveOpen(true) };
  else if (tooSmall) button = { label: `Minimum swap is about $${MIN_SWAP_USD}`, disabled: true };
  else if (priceMoved) button = { label: "Price moved — press to continue", onPress: run };
  else if (busy) button = { label: (steps.find((s) => s.id === activeId)?.label ?? "Swapping") + "…", loading: true };
  else if (quoting || !quote) button = { label: quoteError ? "Quote unavailable" : "Fetching quote…", disabled: true };
  else button = { label: "Swap with passkey", onPress: run };

  const amountBox = ({ label, pill, children, right }: { label: string; pill: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) => (
    <YStack backgroundColor={c.inputBg} borderRadius={radius.input} padding={14} gap={10}>
      <XStack justifyContent='space-between' alignItems='center'>
        <UiText fontSize={12} color={c.muted}>{label}</UiText>
        {right}
      </XStack>
      <XStack alignItems='center' justifyContent='space-between' gap={10}>
        {children}
        {pill}
      </XStack>
    </YStack>
  );

  if (stage === "done" && doneHash) {
    return (
      <>
          <YStack gap={16}>
            <YStack alignItems='center' gap={10} paddingTop={24}>
              <IconBox size={56}><Check size={28} color={c.positive} strokeWidth={2} /></IconBox>
              <UiText fontSize={16} fontWeight='500'>Swapped</UiText>
              <UiText fontSize={13} color={c.muted}>{from} → {to}</UiText>
            </YStack>
            <Card padding={14}>
              <StepList title='Swap complete' timing='' steps={[...steps, { id: "done", label: "Done", sub: `${to} received` }]} activeId={null} allDone />
            </Card>
            <Card paddingTop={4} paddingHorizontal={4} paddingBottom={4}>
              <XStack paddingHorizontal={space.rowX} paddingVertical={space.rowY} justifyContent='space-between' alignItems='center'>
                <UiText fontSize={13.5} color={c.muted}>Transaction</UiText>
                <Mono fontSize={12}>{shortenAddress(doneHash, 8, 8)}</Mono>
              </XStack>
            </Card>
            <YStack gap={8}>
              <PrimaryButton label='Swap again' onPress={() => { setStage(null); setDoneHash(null); }} />
              <SecondaryButton label='View on stellar.expert' onPress={() => Linking.openURL(`https://stellar.expert/explorer/public/tx/${doneHash}`)} />
            </YStack>
          </YStack>
      </>
    );
  }

  return (
    <>
        <YStack gap={space.section}>
          <Card padding={12} gap={8}>
            {amountBox({
              label: "You pay",
              pill: fromPill,
              right: (
                <XStack alignItems='center' gap={8}>
                  <Mono fontSize={11} color={insufficient ? c.failed : c.muted}>
                    {probe.data || from === "USDC" ? `${fNumber(fromBalance, { maximumFractionDigits: from === "XLM" ? 4 : 2 })} ${from}` : "…"}
                  </Mono>
                  <PillButton label='Max' onPress={useMax} />
                </XStack>
              ),
              children: (
              <Input
                flex={1}
                unstyled
                backgroundColor='transparent'
                borderWidth={0}
                color={c.ink}
                placeholderTextColor={c.faint}
                fontFamily='$mono'
                fontSize={28}
                letterSpacing={tracking(28)}
                placeholder='0.00'
                keyboardType='decimal-pad'
                value={amount}
                onChangeText={setAmount}
                editable={!busy}
              />
              )
            })}
            <XStack justifyContent='center' marginVertical={-14} zIndex={1}>
              <IconBox size={32} borderWidth={1} borderColor={c.border} backgroundColor={c.surface} onPress={flip} pressStyle={{ backgroundColor: c.pressTint }}>
                <ArrowDownUp size={16} color={c.ink} strokeWidth={2} />
              </IconBox>
            </XStack>
            {amountBox({
              label: "You receive",
              pill: toPill,
              children: quoting && !quote ? (
                <Skeleton width={120} height={30} />
              ) : (
                <Mono fontSize={28} letterSpacing={tracking(28)} color={quote ? c.ink : c.faint} flex={1} numberOfLines={1}>
                  {quote ? fNumber(parseFloat(quote.amountOut), { maximumFractionDigits: to === "XLM" ? 4 : 2 }) : "0.00"}
                </Mono>
              )
            })}

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

            {from === "XLM" && probe.data?.exists && xlmHoldback > 0 ? (
              <UiText fontSize={11} color={c.faint} paddingHorizontal={4} fontFamily='$mono'>
                Keeps {fNumber(xlmHoldback, { maximumFractionDigits: 2 })} XLM for the network reserve{hasActiveSavings ? " & savings fees" : ""}
              </UiText>
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

          <Card padding={14} gap={12}>
            <StepList title='What happens when you swap' timing='~30s' steps={steps} activeId={activeId} />
            <UiText fontSize={12} color={c.muted} lineHeight={17}>
              Runs on Stellar via Soroswap. Nothing is sent until every confirmation is done — cancelling a prompt charges nothing.
            </UiText>
          </Card>
        </YStack>

      <ReceiveSheet open={receiveOpen} addresses={walletAddresses(wallet)} initialChain='stellar' onClose={() => setReceiveOpen(false)} />
    </>
  );
}
