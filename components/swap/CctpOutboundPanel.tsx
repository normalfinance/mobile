// Cross-chain panel: Stellar USDC → BTC / ETH / SOL via Circle CCTP + LI.FI
// (lib/cctp/engine.ts), rendered by the Swap tab for a USDC → native pair.
// Gates before the first passkey prompt, the step list visible from the start,
// Done gated on delivery. A transfer that outlives the screen continues
// server-side and shows under "In flight".

import React from "react";
import { Alert, Linking } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Input, XStack, YStack } from "tamagui";
import { Check } from "lucide-react-native";

import { Card, IconBox, Mono, PillButton, PrimaryButton, SecondaryButton, Skeleton, UiText } from "@/components/home/primitives";
import { StepList, type Step } from "@/components/savings/StepList";
import { inFlightQueryKey } from "@/components/swap/InFlightTransfers";
import { AutopilotSheet } from "@/components/swap/AutopilotSheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { autopilotAvailable, fetchAutopilotStatus, grantAutopilotConsent } from "@/lib/turnkey/autopilot";
import { useBackendPortfolio } from "@/hooks/use-backend-portfolio";
import { useStellarAccountProbe } from "@/hooks/use-savings";
import { turnkeyWalletQueryKey, useTurnkeyWallet, type WalletChain } from "@/hooks/use-turnkey-wallet";
import { lifiPivotQuote } from "@/lib/cctp/base";
import { NATIVE_CHAIN, NATIVE_DECIMALS, usdcToWire, type CrosschainSymbol } from "@/lib/cctp/config";
import { OutboundError, runOutboundSwap, type OutboundStage } from "@/lib/cctp/engine";
import { refreshAfterStellarAction } from "@/lib/data/after-action";
import { SEND_ASSETS } from "@/lib/send/registry";
import { MIN_XLM_FOR_SOROBAN_TX, xlmAvailableForFees } from "@/lib/stellar/send";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";
import { ensureChainAddress } from "@/lib/turnkey/accounts";
import { describeTurnkeyError, isUserCancelledError } from "@/lib/turnkey/client";
import { ensureDeviceReady } from "@/lib/turnkey/device-check";
import { useDeviceReady } from "@/lib/turnkey/device-ready";
import { fCurrency, fNumber } from "@/lib/utils/number-format.utils";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

const MIN_USD = 10;
const ADDRESS_OF: Record<WalletChain, "stellarAddress" | "bitcoinAddress" | "ethereumAddress" | "solanaAddress"> = {
  stellar: "stellarAddress",
  bitcoin: "bitcoinAddress",
  ethereum: "ethereumAddress",
  solana: "solanaAddress"
};

const fromBaseUnits = (raw: string, decimals: number) => {
  const s = (raw || "0").padStart(decimals + 1, "0");
  return Number(`${s.slice(0, s.length - decimals)}.${s.slice(s.length - decimals)}`);
};

export function CctpOutboundPanel({ to, amount, setAmount, fromPill, toPill }: { to: CrosschainSymbol; amount: string; setAmount: (v: string) => void; fromPill: React.ReactNode; toPill: React.ReactNode }) {
  const c = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useSupabaseAuth();
  const { wallet, refetch: refetchWallet } = useTurnkeyWallet();
  const { ready: deviceReady } = useDeviceReady(wallet?.subOrgId);
  const { portfolioData } = useBackendPortfolio();
  const probe = useStellarAccountProbe(wallet?.stellarAddress, false);

  const [quote, setQuote] = React.useState<{ toAmount: number; feePercent: number; etaMin: number; tool: string | null } | null>(null);
  const [quoting, setQuoting] = React.useState(false);
  const [quoteError, setQuoteError] = React.useState<string | null>(null);
  const [stage, setStage] = React.useState<OutboundStage | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [addingChain, setAddingChain] = React.useState<WalletChain | null>(null);
  const [result, setResult] = React.useState<{ hash: string; verdict: string | null } | null>(null);
  const [failure, setFailure] = React.useState<{ message: string; continues: boolean } | null>(null);

  // Autopilot: server-signed Base legs → one signature per swap. Offered once
  // before the first run; "Not now" is remembered. A grant made now is sticky
  // for this run (web autopilot-gate) even if the status read lags.
  const autopilotQ = useQuery({ queryKey: ["autopilot", "status"], queryFn: fetchAutopilotStatus, enabled: autopilotAvailable() && !!wallet, staleTime: 60_000 });
  const [autopilotGranted, setAutopilotGranted] = React.useState(false);
  const grantedRef = React.useRef(false); // read live by the engine at pivot time
  const autopilotOn = autopilotGranted || autopilotQ.data?.active === true;
  const [consentOpen, setConsentOpen] = React.useState(false);
  const [consentBusy, setConsentBusy] = React.useState(false);
  const consentResolver = React.useRef<((v: boolean) => void) | null>(null);
  const DECLINED_KEY = "autopilot_declined_v1";
  /** Resolves true when autopilot is (now) on, false to proceed with prompts. */
  const maybeOfferConsent = async (): Promise<boolean> => {
    if (!autopilotAvailable() || autopilotOn) return autopilotOn;
    if ((await AsyncStorage.getItem(DECLINED_KEY).catch(() => null)) != null) return false;
    return new Promise<boolean>((resolve) => {
      consentResolver.current = resolve;
      setConsentOpen(true);
    });
  };
  const enableAutopilot = async () => {
    if (!wallet?.subOrgId) return;
    setConsentBusy(true);
    try {
      await grantAutopilotConsent(wallet.subOrgId);
      grantedRef.current = true;
      setAutopilotGranted(true);
      void queryClient.invalidateQueries({ queryKey: ["autopilot", "status"] });
      setConsentOpen(false);
      consentResolver.current?.(true);
    } catch (e) {
      if (!isUserCancelledError(e)) Alert.alert("Couldn’t enable", e instanceof Error ? e.message : describeTurnkeyError(e));
    } finally {
      setConsentBusy(false);
    }
  };
  const declineAutopilot = () => {
    void AsyncStorage.setItem(DECLINED_KEY, String(Date.now())).catch(() => undefined);
    setConsentOpen(false);
    consentResolver.current?.(false);
  };

  const stellarAddress = wallet?.stellarAddress ?? null;
  const evmAddress = wallet?.ethereumAddress ?? null; // the Base pivot address (same key on every EVM chain)
  const toChain = NATIVE_CHAIN[to];
  const toAddress = wallet ? wallet[ADDRESS_OF[toChain]] : null;

  const usdcBalance = probe.data?.usdcBalance ?? Number(portfolioData.assets.find((a) => a.asset_code === "USDC")?.balance ?? 0);
  const xlmFree = probe.data ? xlmAvailableForFees(probe.data.xlmBalance, probe.data.subentryCount) : null;
  const lowXlm = xlmFree !== null && xlmFree < MIN_XLM_FOR_SOROBAN_TX;
  const amountNum = Number(amount.replace(",", "."));
  const amountOk = Number.isFinite(amountNum) && amountNum > 0;
  const amount6 = amountOk ? Math.floor(amountNum * 1e6) / 1e6 : 0;
  const insufficient = amountOk && amount6 > usdcBalance + 1e-9;
  const tooSmall = amountOk && amount6 < MIN_USD;
  const price = (sym: string) => portfolioData.assets.find((a) => a.asset_code === sym)?.usdPrice ?? 0;

  // Display quote: LI.FI USDC(Base) → target, 600ms debounce, stale drops.
  const reqRef = React.useRef(0);
  React.useEffect(() => {
    if (busy || !amountOk || tooSmall || !evmAddress || !toAddress) {
      setQuote(null);
      return;
    }
    const id = ++reqRef.current;
    const t = setTimeout(async () => {
      setQuoting(true);
      try {
        const data = await lifiPivotQuote({ evmAddress, toSymbol: to, toAddress, amountWire: usdcToWire(amount6.toFixed(6)) });
        if (reqRef.current !== id) return;
        if (!data.success || !data.quote?.estimate?.toAmountMin) {
          setQuote(null);
          setQuoteError(data.error ?? "No route right now");
          return;
        }
        setQuote({
          toAmount: fromBaseUnits(data.quote.estimate.toAmountMin, NATIVE_DECIMALS[to]),
          feePercent: typeof data.feePercent === "number" ? data.feePercent : 0,
          etaMin: Math.max(2, Math.round((data.quote.estimate.executionDuration ?? 300) / 60)) + 2, // + Stellar attestation
          tool: data.quote.tool ?? null
        });
        setQuoteError(null);
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
  }, [amount6, amountOk, tooSmall, to, evmAddress, toAddress, busy]);

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

  const tick = (s: OutboundStage) => {
    setStage(s);
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const run = async () => {
    if (!wallet?.subOrgId || !stellarAddress || !evmAddress || !toAddress || !quote) return;
    setBusy(true);
    setFailure(null);
    try {
      const gate = await ensureDeviceReady(wallet.subOrgId, stellarAddress, deviceReady);
      if (gate.outcome === "needs-setup") {
        router.push("/setup-device");
        return;
      }
      if (gate.outcome === "cancelled") return;
      if (gate.outcome === "failed") {
        Alert.alert("Couldn’t verify this phone", describeTurnkeyError(gate.error));
        return;
      }
      // Consent moment at swap start (web, Niko 2026-08-21) — a grant now
      // makes THIS swap single-signature.
      const withAutopilot = await maybeOfferConsent();
      void queryClient.invalidateQueries({ queryKey: ["activity"] }); // the row appears at start (web)
      const r = await runOutboundSwap({
        subOrgId: wallet.subOrgId,
        stellarAddress,
        evmAddress,
        toSymbol: to,
        toAddress,
        amount: amount6.toFixed(6).replace(/\.?0+$/, "") || "0",
        feePercent: quote.feePercent,
        lifiTool: quote.tool,
        onStage: tick,
        autopilotHint: () => withAutopilot || grantedRef.current
      });
      // Done: the target chain's feed + portfolio, cache-bypassed (15s cap).
      await Promise.race([
        refreshAfterStellarAction(queryClient, { userId: user?.id, stellarAddress, chain: toChain, chainAddress: toAddress, expectMove: [to] }),
        new Promise((res) => setTimeout(res, 15_000))
      ]);
      setResult({ hash: r.dstSwapTxHash ?? r.burnTxHash, verdict: r.deliveryVerdict });
      setAmount("");
      setQuote(null);
    } catch (e) {
      setStage(null);
      if (isUserCancelledError(e)) {
        Alert.alert("Cancelled", "Nothing was sent and nothing was charged.");
      } else if (e instanceof OutboundError) {
        setFailure({
          message: e.optionsExhausted
            ? "The exchange route on Base kept failing. Your USDC is safe at your own Base address — use “Bring back as USDC” under In flight to return it to Stellar."
            : e.broadcastStarted
              ? `${e.message} — your transfer continues on our servers; check In flight below.`
              : e.message,
          continues: e.broadcastStarted
        });
      } else {
        setFailure({ message: e instanceof Error ? e.message : describeTurnkeyError(e), continues: false });
      }
    } finally {
      setBusy(false);
      void queryClient.invalidateQueries({ queryKey: inFlightQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
    }
  };

  const steps: Step[] = [
    { id: "burn-prepare", label: "Preparing the bridge transaction", sub: "A few seconds — no action needed yet" },
    { id: "burn", label: "Starting the Circle bridge", sub: "Confirm with passkey · 1–2 confirmations" },
    { id: "bridging", label: "Bridging to Base", sub: "Circle attestation — about a minute" },
    { id: "topup", label: "Covering network fees", sub: "Normal sends gas to your address" },
    { id: "pivot-swap", label: `Swapping USDC to ${to}`, sub: autopilotOn ? "Via LI.FI · automatic — no signature needed" : "Via LI.FI · confirm with passkey" },
    { id: "delivering", label: `Delivering ${to}`, sub: `Cross-chain arrival — up to ${to === "BTC" ? "60" : "5"} min` }
  ];

  // Gates, in time-to-resolve order.
  let button: { label: string; onPress?: () => void; disabled?: boolean; loading?: boolean };
  if (!stellarAddress) button = { label: "Stellar wallet required", disabled: true };
  else if (!evmAddress) button = { label: addingChain === "ethereum" ? "Adding…" : "Add Ethereum to your wallet", onPress: () => void addChain("ethereum"), loading: addingChain === "ethereum" };
  else if (!toAddress) button = { label: addingChain === toChain ? "Adding…" : `Add ${SEND_ASSETS[to].name} to your wallet`, onPress: () => void addChain(toChain), loading: addingChain === toChain };
  else if (lowXlm) button = { label: "Receive XLM for the network fee", onPress: () => router.push("/(tabs)/savings") };
  else if (!amountOk) button = { label: "Enter an amount", disabled: true };
  else if (tooSmall) button = { label: `Minimum swap is $${MIN_USD}`, disabled: true };
  else if (insufficient) button = { label: "Insufficient USDC", disabled: true };
  else if (busy) button = { label: (steps.find((s) => s.id === stage)?.label ?? "Working") + "…", loading: true };
  else if (quoting || !quote) button = { label: quoteError ? "No route right now" : "Fetching quote…", disabled: true };
  else button = { label: "Swap with passkey", onPress: run };

  if (result) {
    return (
          <YStack gap={16}>
            <YStack alignItems='center' gap={10} paddingTop={24}>
              <IconBox size={56}><Check size={28} color={c.positive} strokeWidth={2} /></IconBox>
              <UiText fontSize={16} fontWeight='500'>{result.verdict === "DONE" ? `${to} delivered` : `${to} is on its way`}</UiText>
              {result.verdict !== "DONE" ? <UiText fontSize={13} color={c.muted} textAlign='center'>Delivery is taking longer than usual — it lands in your wallet without any action.</UiText> : null}
            </YStack>
            <Card padding={14}><StepList title='Swap complete' timing='' steps={[...steps, { id: "done", label: "Done", sub: `${to} delivered` }]} activeId={null} allDone /></Card>
            <YStack gap={8}>
              <PrimaryButton label='Swap again' onPress={() => setResult(null)} />
              <SecondaryButton label='View on explorer' onPress={() => Linking.openURL(`https://basescan.org/tx/${result.hash}`)} />
            </YStack>
          </YStack>
    );
  }

  return (
          <YStack gap={20}>
            <Card padding={12} gap={8}>
              <YStack backgroundColor={c.inputBg} borderRadius={radius.input} padding={14} gap={10}>
                <XStack justifyContent='space-between' alignItems='center'>
                  <UiText fontSize={12} color={c.muted}>You pay</UiText>
                  <XStack alignItems='center' gap={8}>
                    <Mono fontSize={11} color={insufficient ? c.failed : c.muted}>{fNumber(usdcBalance, { maximumFractionDigits: 2 })} USDC</Mono>
                    <PillButton label='Max' onPress={() => setAmount((Math.floor(usdcBalance * 1e6) / 1e6).toString())} />
                  </XStack>
                </XStack>
                <XStack alignItems='center' justifyContent='space-between' gap={10}>
                  <Input flex={1} unstyled backgroundColor='transparent' borderWidth={0} color={c.ink} placeholderTextColor={c.faint} fontFamily='$mono' fontSize={28} letterSpacing={tracking(28)} placeholder='0.00' keyboardType='decimal-pad' value={amount} onChangeText={setAmount} editable={!busy} />
                  {fromPill}
                </XStack>
              </YStack>

              <YStack backgroundColor={c.inputBg} borderRadius={radius.input} padding={14} gap={10}>
                <UiText fontSize={12} color={c.muted}>You receive (minimum)</UiText>
                <XStack alignItems='center' justifyContent='space-between' gap={10}>
                  {quoting && !quote ? <Skeleton width={120} height={30} /> : (
                    <Mono fontSize={28} letterSpacing={tracking(28)} color={quote ? c.ink : c.faint} flex={1} numberOfLines={1}>
                      {quote ? fNumber(quote.toAmount, { maximumFractionDigits: to === "BTC" ? 6 : 4 }) : "0.00"}
                    </Mono>
                  )}
                  {toPill}
                </XStack>
              </YStack>

              {quote ? (
                <YStack paddingHorizontal={4} paddingTop={6} gap={6}>
                  <XStack justifyContent='space-between'><UiText fontSize={12} color={c.muted}>Normal fee ({+(quote.feePercent * 100).toFixed(2)}%)</UiText><Mono fontSize={12}>−{(amount6 * quote.feePercent).toFixed(4)} USDC</Mono></XStack>
                  <XStack justifyContent='space-between'><UiText fontSize={12} color={c.muted}>Value</UiText><Mono fontSize={12}>{fCurrency(quote.toAmount * price(to))}</Mono></XStack>
                  <XStack justifyContent='space-between'><UiText fontSize={12} color={c.muted}>Estimated time</UiText><Mono fontSize={12}>~{quote.etaMin} min</Mono></XStack>
                </YStack>
              ) : quoteError && amountOk && !tooSmall ? (
                <UiText fontSize={12} color={c.failed} paddingHorizontal={4}>{quoteError}</UiText>
              ) : null}

              {lowXlm ? (
                <YStack padding={12} borderRadius={radius.input} backgroundColor={c.chips.amber.bg} marginTop={6}>
                  <UiText fontSize={13} color={c.chips.amber.color} lineHeight={19}>The bridge transaction pays its network fee in XLM. Receive about {(MIN_XLM_FOR_SOROBAN_TX + 0.1).toFixed(1)} XLM first.</UiText>
                </YStack>
              ) : null}
              {failure ? (
                <YStack padding={12} borderRadius={radius.input} backgroundColor={c.chips.amber.bg} marginTop={6}>
                  <UiText fontSize={13} color={c.chips.amber.color} lineHeight={19}>{failure.message}</UiText>
                </YStack>
              ) : null}

              <YStack marginTop={6}>
                <PrimaryButton label={button.label} onPress={button.onPress} disabled={button.disabled} loading={button.loading} />
              </YStack>
            </Card>

            <Card padding={14} gap={12}>
              <StepList title='What happens when you swap' timing={quote ? `~${quote.etaMin} min` : ""} steps={steps} activeId={stage === "done" ? null : stage} />
              <UiText fontSize={12} color={c.muted} lineHeight={17}>
                {autopilotOn
                  ? `One signing step — everything after the bridge completes automatically, even if you close the app. ${to} is delivered to your own ${SEND_ASSETS[to].name} address.`
                  : `Your USDC is bridged by Circle to your own Base address, then swapped to ${to} and delivered to your ${SEND_ASSETS[to].name} address. The Base step needs your passkey, so stay in the app until it's done — or enable automatic completion when asked.`}
              </UiText>
            </Card>

            {busy && !autopilotOn && autopilotAvailable() && autopilotQ.data?.active === false && stage && ["burn-prepare", "burn", "bridging", "topup"].includes(stage) ? (
              <Card padding={14} gap={10} backgroundColor={c.chips.blue.bg} borderColor='transparent'>
                <UiText fontSize={13} color={c.ink2} lineHeight={19}>
                  Don’t want to wait around for the next confirmation? Enable automatic completion and this swap finishes by itself.
                </UiText>
                <PrimaryButton label={consentBusy ? "Confirming…" : "Enable auto-finish"} onPress={() => void enableAutopilot()} loading={consentBusy} />
              </Card>
            ) : null}

            <AutopilotSheet open={consentOpen} busy={consentBusy} onEnable={() => void enableAutopilot()} onNotNow={declineAutopilot} />

          </YStack>
  );
}
