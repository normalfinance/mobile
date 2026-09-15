// Cross-chain panel: Stellar USDC → BTC / ETH / SOL via Circle CCTP + LI.FI
// (lib/cctp/engine.ts), rendered by the Swap tab for a USDC → native pair.
// Gates before the first passkey prompt, the step list visible from the start,
// Done gated on delivery. A transfer that outlives the screen continues
// server-side and shows under "In flight".

import React from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { XStack, YStack } from "tamagui";

import { Card, Mono, PrimaryButton, Skeleton, UiText } from "@/components/home/primitives";
import { AmountInput } from "@/components/swap/AmountInput";
import { setPendingRun } from "@/lib/swap/run-store";
import { useBackendPortfolio } from "@/hooks/use-backend-portfolio";
import { useStellarAccountProbe } from "@/hooks/use-savings";
import { turnkeyWalletQueryKey, useTurnkeyWallet, type WalletChain } from "@/hooks/use-turnkey-wallet";
import { lifiPivotQuote } from "@/lib/cctp/base";
import { NATIVE_CHAIN, NATIVE_DECIMALS, usdcToWire, type CrosschainSymbol } from "@/lib/cctp/config";
import { SEND_ASSETS } from "@/lib/send/registry";
import { MIN_XLM_FOR_SOROBAN_TX, xlmAvailableForFees } from "@/lib/stellar/send";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";
import { ensureChainAddress } from "@/lib/turnkey/accounts";
import { describeTurnkeyError, isUserCancelledError } from "@/lib/turnkey/client";
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
  const { portfolioData } = useBackendPortfolio();
  const probe = useStellarAccountProbe(wallet?.stellarAddress, false);

  const [quote, setQuote] = React.useState<{ toAmount: number; feePercent: number; etaMin: number; tool: string | null } | null>(null);
  const [quoting, setQuoting] = React.useState(false);
  const [quoteError, setQuoteError] = React.useState<string | null>(null);
  const [addingChain, setAddingChain] = React.useState<WalletChain | null>(null);

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
    if (!amountOk || tooSmall || !evmAddress || !toAddress) {
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
  }, [amount6, amountOk, tooSmall, to, evmAddress, toAddress]);

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
    if (!wallet?.subOrgId || !stellarAddress || !evmAddress || !toAddress || !quote) return;
    const runId = setPendingRun({ kind: "cctp-out", from: "USDC", to, amount: amount6.toFixed(6).replace(/\.?0+$/, "") || "0", feePercent: quote.feePercent, lifiTool: quote.tool, toAddress, etaMin: quote.etaMin, toAmount: quote.toAmount });
    setAmount("");
    setQuote(null);
    router.push({ pathname: "/swap-run", params: { runId } });
  };

  // Gates, in time-to-resolve order.
  let button: { label: string; onPress?: () => void; disabled?: boolean; loading?: boolean };
  if (!stellarAddress) button = { label: "Stellar wallet required", disabled: true };
  else if (!evmAddress) button = { label: addingChain === "ethereum" ? "Adding…" : "Add Ethereum to your wallet", onPress: () => void addChain("ethereum"), loading: addingChain === "ethereum" };
  else if (!toAddress) button = { label: addingChain === toChain ? "Adding…" : `Add ${SEND_ASSETS[to].name} to your wallet`, onPress: () => void addChain(toChain), loading: addingChain === toChain };
  else if (lowXlm) button = { label: "Receive XLM for the network fee", onPress: () => router.push("/(tabs)/savings") };
  else if (!amountOk) button = { label: "Enter an amount", disabled: true };
  else if (tooSmall) button = { label: `Minimum swap is $${MIN_USD}`, disabled: true };
  else if (insufficient) button = { label: "Insufficient USDC", disabled: true };
  else if (quoting || !quote) button = { label: quoteError ? "No route right now" : "Fetching quote…", disabled: true };
  else button = { label: "Swap with passkey", onPress: run };

  return (
          <YStack gap={20}>
            <Card padding={12} gap={8}>
              <AmountInput amount={amount} setAmount={setAmount} symbol='USDC' price={price("USDC") || 1} spendable={usdcBalance} decimals={6} balanceDecimals={2} pill={fromPill} insufficient={insufficient} />

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
                {quote ? <Mono fontSize={11} color={c.faint}>≈ {fCurrency(quote.toAmount * price(to))}</Mono> : null}
              </YStack>

              {quote ? (
                <YStack paddingHorizontal={4} paddingTop={6} gap={6}>
                  <XStack justifyContent='space-between'><UiText fontSize={12} color={c.muted}>Normal fee ({+(quote.feePercent * 100).toFixed(2)}%)</UiText><Mono fontSize={12}>−{(amount6 * quote.feePercent).toFixed(4)} USDC</Mono></XStack>
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

              <YStack marginTop={6}>
                <PrimaryButton label={button.label} onPress={button.onPress} disabled={button.disabled} loading={button.loading} />
              </YStack>
            </Card>

          </YStack>
  );
}
