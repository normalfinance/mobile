// Buy — Coinbase Onramp in an in-app browser (lib/ramp/coinbase.ts). Web's
// onramp-dialog.tsx flow: session token → hosted checkout → a ramp_transfers
// row watches the chain and the Activity feed shows "Bought · Pending" until
// the balance rises. Chains the wallet has no address for yet get one here
// (lazy CREATE_WALLET_ACCOUNTS, one passkey) — a new user's first funding.

import React from "react";
import { Alert, ScrollView } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Input, XStack, YStack } from "tamagui";
import { ChevronLeft, ExternalLink } from "lucide-react-native";

import { AssetIcon } from "@/components/ui/AssetIcon";
import { Card, IconButton, Mono, PrimaryButton, Screen, UiText } from "@/components/home/primitives";
import { useBackendPortfolio } from "@/hooks/use-backend-portfolio";
import { useStellarAccountProbe } from "@/hooks/use-savings";
import { turnkeyWalletQueryKey, useTurnkeyWallet, type WalletChain } from "@/hooks/use-turnkey-wallet";
import { refreshAfterStellarAction } from "@/lib/data/after-action";
import {
  BUY_ASSETS,
  BUY_PRESETS_USD,
  BUY_RETURN_URL,
  createCoinbasePayOnrampURL,
  createCoinbaseSession,
  recordOnrampHandoff,
  type BuyAsset
} from "@/lib/ramp/coinbase";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";
import { ensureChainAddress } from "@/lib/turnkey/accounts";
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
    if (!wallet) return;
    setAddingChain(true);
    try {
      const updated = await ensureChainAddress(wallet, meta.chain);
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
      const url = createCoinbasePayOnrampURL({ amountUsd: amountNum, assetSymbol: asset, sessionToken: token, redirectUrl: BUY_RETURN_URL });
      setHandedOff(true);
      // Returns when Coinbase redirects to normalapp://buy or the user closes the sheet.
      await WebBrowser.openAuthSessionAsync(url, BUY_RETURN_URL, { preferEphemeralSession: false });
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

            <UiText fontSize={12} color={c.muted} marginTop={4}>Amount (USD)</UiText>
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
                    <Mono fontSize={13} color={selected ? c.ctaText : c.ink}>${p}</Mono>
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

          {wallet && !address ? (
            <Card padding={14} gap={10}>
              <UiText fontSize={14} fontWeight='500'>Add {meta.chain} to your wallet</UiText>
              <UiText fontSize={13} color={c.muted} lineHeight={18}>
                Your Normal wallet has no {meta.label} address yet. One passkey confirmation creates it on the same wallet — nothing new to back up.
              </UiText>
              <PrimaryButton label={addingChain ? "Adding…" : `Add ${meta.chain}`} onPress={addChain} loading={addingChain} />
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
