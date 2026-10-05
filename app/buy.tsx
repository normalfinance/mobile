// Buy — Coinbase Onramp in an in-app browser (lib/ramp/coinbase.ts). Web's
// onramp-dialog.tsx flow: session token → hosted checkout → a ramp_transfers
// row watches the chain and the Activity feed shows "Bought · Pending" until
// the balance rises. Chains the wallet has no address for yet get one here
// (lazy CREATE_WALLET_ACCOUNTS, one passkey) — a new user's first funding.

import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, ScrollView } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Input, XStack, YStack } from "tamagui";
import { ChevronLeft, ExternalLink } from "lucide-react-native";

import { AssetIcon } from "@/components/ui/AssetIcon";
import { Card, IconButton, Mono, PrimaryButton, Screen, SecondaryButton, UiText } from "@/components/home/primitives";
import { useBackendPortfolio } from "@/hooks/use-backend-portfolio";
import { useStellarAccountProbe } from "@/hooks/use-savings";
import { turnkeyWalletQueryKey, useTurnkeyWallet, type WalletChain } from "@/hooks/use-turnkey-wallet";
import { refreshAfterStellarAction } from "@/lib/data/after-action";
import {
  BUY_ASSETS,
  BUY_FIATS,
  BUY_PRESETS_USD,
  FIAT_SYMBOL,
  defaultBuyFiat,
  type BuyFiat,
  BUY_RETURN_URL,
  createCoinbasePayOnrampURL,
  createCoinbaseSession,
  recordOnrampHandoff,
  type BuyAsset
} from "@/lib/ramp/coinbase";
import { useColors } from "@/lib/theme/appearance";
import { createStripeURL } from "@/lib/ramp/stripe";
import { radius, space, tracking } from "@/lib/theme/tokens";
import { provisionChain } from "@/lib/turnkey/provision";
import { describeTurnkeyError, isUserCancelledError } from "@/lib/turnkey/client";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

const ADDRESS_FIELD: Record<WalletChain, "stellarAddress" | "bitcoinAddress" | "ethereumAddress" | "solanaAddress"> = {
  stellar: "stellarAddress",
  bitcoin: "bitcoinAddress",
  ethereum: "ethereumAddress",
  solana: "solanaAddress"
};

export default function BuyScreen() {
  const c = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ asset?: string }>();
  const { user } = useSupabaseAuth();
  const { wallet, refetch } = useTurnkeyWallet();
  const { portfolioData } = useBackendPortfolio();
  const probe = useStellarAccountProbe(wallet?.stellarAddress, false);

  const initial = BUY_ASSETS.find((a) => a.asset === (params.asset ?? "").toUpperCase())?.asset ?? "USDC";
  const [asset, setAsset] = React.useState<BuyAsset>(initial);
  const [amount, setAmount] = React.useState(String(BUY_PRESETS_USD[1]));
  const [fiat, setFiat] = React.useState<BuyFiat>(defaultBuyFiat());
  React.useEffect(() => {
    void AsyncStorage.getItem("buy_fiat_v1").then((v) => v && (BUY_FIATS as readonly string[]).includes(v) && setFiat(v as BuyFiat)).catch(() => undefined);
  }, []);
  const chooseFiat = (f: BuyFiat) => {
    setFiat(f);
    void AsyncStorage.setItem("buy_fiat_v1", f).catch(() => undefined);
  };
  const [busy, setBusy] = React.useState(false);
  const [addingChain, setAddingChain] = React.useState(false);
  const [handedOff, setHandedOff] = React.useState(false);

  const meta = BUY_ASSETS.find((a) => a.asset === asset)!;
  // Web: USDC on Stellar needs an active account + USDC trustline; XLM needs
  // nothing (the purchase activates the account itself).
  const usdcBlocked = asset === "USDC" && !!probe.data && (!probe.data.exists || !probe.data.hasUsdcTrustline);
  const address = wallet ? wallet[ADDRESS_FIELD[meta.chain]] : null;
  const amountNum = Number(amount.replace(",", "."));
  const amountOk = Number.isFinite(amountNum) && amountNum >= 5;

  const addChain = async () => {
    if (!user) return;
    setAddingChain(true);
    try {
      const updated = await provisionChain({ user, wallet, chain: meta.chain });
      queryClient.setQueryData(turnkeyWalletQueryKey(user?.id), updated);
      await refetch();
    } catch (e) {
      if (!isUserCancelledError(e)) Alert.alert("Couldn’t add the chain", describeTurnkeyError(e));
    } finally {
      setAddingChain(false);
    }
  };

  const buy = async () => {
    if (!address || !amountOk) return;
    setBusy(true);
    try {
      // Baseline for EVERY chain (web incident 2026-08-26: null baselines on
      // native chains left ghost "Buying SOL" rows for hours).
      const baseline = Number(portfolioData.assets.find((a) => a.asset_code === asset)?.balance ?? 0);
      await recordOnrampHandoff({ asset, chain: meta.chain, walletAddress: address, amountUsd: amountNum, baselineBalance: baseline });
      // The session token is SINGLE-USE: mint it last and open it immediately.
      const token = await createCoinbaseSession(address, asset, meta.chain);
      const url = createCoinbasePayOnrampURL({ amountUsd: amountNum, assetSymbol: asset, sessionToken: token, fiat, redirectUrl: BUY_RETURN_URL });
      setHandedOff(true);
      // Returns when Coinbase redirects to normalapp://buy or the user closes the sheet.
      // Ephemeral: no iOS "wants to use pay.coinbase.com to sign in" alert.
      // Trade-off: Coinbase's own login isn't remembered between purchases.
      await WebBrowser.openAuthSessionAsync(url, BUY_RETURN_URL, { preferEphemeralSession: true });
      void refreshAfterStellarAction(queryClient, { userId: user?.id, stellarAddress: wallet?.stellarAddress });
      void queryClient.invalidateQueries({ queryKey: ["activity", "ramps"] });
    } catch (e) {
      Alert.alert("Couldn’t open Coinbase", e instanceof Error ? e.message : "Please try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps='handled'>
        <YStack paddingHorizontal={space.gutter} paddingTop={56} gap={20}>
          <XStack alignItems='center' gap={4}>
            <IconButton onPress={() => router.back()} label='Back'>
              <ChevronLeft size={22} color={c.ink} strokeWidth={2} />
            </IconButton>
            <UiText fontSize={22} fontWeight='600' letterSpacing={tracking(22)}>
              Buy
            </UiText>
          </XStack>

          <Card padding={14} gap={12}>
            <UiText fontSize={12} color={c.muted}>Asset</UiText>
            <XStack flexWrap='wrap' gap={6}>
              {BUY_ASSETS.map((a) => {
                const selected = a.asset === asset;
                return (
                  <XStack
                    key={a.asset}
                    onPress={() => setAsset(a.asset)}
                    alignItems='center'
                    gap={8}
                    paddingVertical={6}
                    paddingLeft={6}
                    paddingRight={12}
                    borderRadius={radius.pill}
                    borderWidth={1}
                    borderColor={selected ? c.ink : c.border}
                    backgroundColor={selected ? c.ink : "transparent"}
                  >
                    <AssetIcon symbol={a.asset} size={24} fontSize='$2' />
                    <UiText fontSize={13} fontWeight='600' color={selected ? c.ctaText : c.ink}>{a.asset}</UiText>
                  </XStack>
                );
              })}
            </XStack>
            <UiText fontSize={12} color={c.faint}>{meta.label}</UiText>

            <XStack justifyContent='space-between' alignItems='center' marginTop={4}>
              <UiText fontSize={12} color={c.muted}>Amount</UiText>
              <XStack gap={4}>
                {BUY_FIATS.map((f) => (
                  <XStack key={f} onPress={() => chooseFiat(f)} paddingHorizontal={10} height={26} alignItems='center' borderRadius={radius.pill} borderWidth={1} borderColor={fiat === f ? c.ink : c.border} backgroundColor={fiat === f ? c.ink : "transparent"} accessibilityRole='button' accessibilityState={{ selected: fiat === f }}>
                    <UiText fontSize={11} fontWeight='600' color={fiat === f ? c.ctaText : c.ink}>{f}</UiText>
                  </XStack>
                ))}
              </XStack>
            </XStack>
            <XStack gap={6}>
              {BUY_PRESETS_USD.map((p) => {
                const selected = Number(amount) === p;
                return (
                  <XStack
                    key={p}
                    flex={1}
                    onPress={() => setAmount(String(p))}
                    height={40}
                    alignItems='center'
                    justifyContent='center'
                    borderRadius={radius.smallButton}
                    borderWidth={1}
                    borderColor={selected ? c.ink : c.border}
                    backgroundColor={selected ? c.ink : "transparent"}
                  >
                    <Mono fontSize={13} color={selected ? c.ctaText : c.ink}>{FIAT_SYMBOL[fiat]}{p}</Mono>
                  </XStack>
                );
              })}
            </XStack>
            <Input
              backgroundColor={c.inputBg}
              borderWidth={1}
              borderColor={c.border}
              borderRadius={radius.input}
              color={c.ink}
              placeholderTextColor={c.faint}
              height={52}
              fontFamily='$mono'
              fontSize={22}
              letterSpacing={tracking(22)}
              placeholder='Custom amount'
              keyboardType='decimal-pad'
              value={amount}
              onChangeText={setAmount}
              editable={!busy}
            />
            {!amountOk && amount ? <UiText fontSize={12} color={c.failed}>Minimum purchase is $5.</UiText> : null}
          </Card>

          {!address ? (
            <Card padding={14} gap={10}>
              <UiText fontSize={14} fontWeight='500'>{wallet ? `Add ${meta.chain} to your wallet` : `Set up your ${meta.chain} wallet`}</UiText>
              <UiText fontSize={13} color={c.muted} lineHeight={18}>
                {wallet
                  ? `Your Normal wallet has no ${meta.label} address yet. One passkey confirmation creates it on the same wallet — nothing new to back up.`
                  : `Coinbase delivers ${asset} to your own ${meta.chain} address. One passkey confirmation creates your Normal wallet with it — you’ll get a recovery phrase to write down.`}
              </UiText>
              <PrimaryButton label={addingChain ? "Confirm with your passkey…" : wallet ? `Add ${meta.chain}` : `Set up ${meta.chain} wallet`} onPress={addChain} loading={addingChain} />
            </Card>
          ) : usdcBlocked ? (
            <Card padding={14} gap={10}>
              <UiText fontSize={14} fontWeight='500'>Set up USDC first</UiText>
              <UiText fontSize={13} color={c.muted} lineHeight={18}>
                {probe.data?.exists
                  ? "Your Stellar account needs a USDC trustline before Coinbase can deliver USDC. Add it in Savings, then come back."
                  : "Your Stellar account isn’t active yet. Buy XLM first (it activates the account), then USDC."}
              </UiText>
              <PrimaryButton label={probe.data?.exists ? "Go to Savings setup" : "Buy XLM instead"} onPress={() => (probe.data?.exists ? router.push("/(tabs)/savings") : setAsset("XLM"))} />
            </Card>
          ) : (
            <YStack gap={10}>
              <PrimaryButton label={busy ? "Opening Coinbase…" : "Continue with Coinbase"} onPress={buy} disabled={!address || !amountOk} loading={busy} />
              <XStack alignItems='center' justifyContent='center' gap={6}>
                <ExternalLink size={12} color={c.faint} strokeWidth={2} />
                <UiText fontSize={11} color={c.faint} fontFamily='$mono'>Debit card, Apple Pay, Coinbase balance · delivered to your wallet</UiText>
              </XStack>
              {asset === "USDC" ? (
                <SecondaryButton label='Deposit cash at a MoneyGram location' onPress={() => router.push("/deposit-cash")} disabled={busy} />
              ) : null}
              <SecondaryButton label='Pay with Stripe' onPress={() => void WebBrowser.openBrowserAsync(createStripeURL(amountNum, asset.toLowerCase(), meta.chain))} disabled={busy || !amountOk} />
              <UiText fontSize={11} color={c.faint} textAlign='center'>Card, bank or Apple Pay — you enter your wallet address on Stripe’s page.</UiText>
            </YStack>
          )}

          {handedOff ? (
            <Card padding={14} gap={6} backgroundColor={c.chips.blue.bg} borderColor='transparent'>
              <UiText fontSize={14} fontWeight='500'>Watching for your {asset}</UiText>
              <UiText fontSize={13} color={c.ink2} lineHeight={18}>
                Coinbase delivers to your wallet in a few minutes. It shows as pending in Activity until it lands — you can close this screen.
              </UiText>
            </Card>
          ) : null}
        </YStack>
      </ScrollView>
    </Screen>
  );
}
