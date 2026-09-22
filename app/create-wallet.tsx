// Get started — the web onboarding's asset-first step (get-started-picker.tsx,
// confirmed by the web agent 2026-09-22). No "create wallet" screen, no
// password: the user picks what they want to hold, then Buy or Receive it;
// the wallet for THAT chain (and only that chain — hard rule 7) is created
// inside the flow with one passkey. "Skip for now" leaves the account
// wallet-less; every Buy / Receive / Send / Swap / Savings entry point
// provisions the chain on demand later. Route name kept for the tabs gate.

import React from "react";
import { Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { XStack, YStack } from "tamagui";
import { ArrowDownToLine, ChevronLeft, CreditCard, Fingerprint } from "lucide-react-native";

import { Card, Divider, IconBox, PillButton, PrimaryButton, Screen, UiText } from "@/components/home/primitives";
import { ReceiveSheet } from "@/components/home/ReceiveSheet";
import { AssetIcon } from "@/components/ui/AssetIcon";
import { turnkeyWalletQueryKey, useTurnkeyWallet, walletAddresses, type WalletChain } from "@/hooks/use-turnkey-wallet";
import { supabase } from "@/lib/supabase";
import { hasSkippedOnboarding, skipOnboarding } from "@/lib/onboarding";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";
import { describeTurnkeyError, isUserCancelledError } from "@/lib/turnkey/client";
import { WalletLimitError, provisionChain } from "@/lib/turnkey/provision";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

// Web get-started-picker.tsx:21-26 — the five, in this order; chain = the asset's.
const ASSETS: { symbol: string; name: string; chain: WalletChain; chainName: string }[] = [
  { symbol: "USDC", name: "USD Coin", chain: "stellar", chainName: "Stellar" },
  { symbol: "XLM", name: "Stellar Lumens", chain: "stellar", chainName: "Stellar" },
  { symbol: "BTC", name: "Bitcoin", chain: "bitcoin", chainName: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum", chain: "ethereum", chainName: "Ethereum" },
  { symbol: "SOL", name: "Solana", chain: "solana", chainName: "Solana" }
];

export default function GetStartedScreen() {
  const c = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useSupabaseAuth();
  const { wallet, status, refetch } = useTurnkeyWallet();
  const [picked, setPicked] = React.useState<(typeof ASSETS)[number] | null>(null);
  const [busy, setBusy] = React.useState<"buy" | "receive" | null>(null);
  const [receiveOpen, setReceiveOpen] = React.useState(false);

  // A returning user who already has a wallet never sees this screen.
  React.useEffect(() => {
    if (status === "ready" || (status === "no-stellar" && wallet)) router.replace("/(tabs)");
  }, [status, wallet]);

  const hasChain = (chain: WalletChain) => !!walletAddresses(wallet).find((a) => a.chain === chain);

  // Web startFlow (use-asset-actions.tsx:148-156): no address for the chain →
  // ChainSetupDialog (one passkey) → then the Buy or Receive the user chose.
  const start = async (flow: "buy" | "receive") => {
    if (!picked || !user) return;
    setBusy(flow);
    try {
      let w = wallet;
      const created = !hasChain(picked.chain);
      if (created) {
        w = await provisionChain({ user, wallet, chain: picked.chain });
        queryClient.setQueryData(turnkeyWalletQueryKey(user.id), w);
        await refetch();
      }
      skipOnboarding(); // the tabs gate must not bounce back here mid-flow
      if (created && !wallet) {
        // A brand-new seed: show the recovery phrase first (web's backup
        // gate), then continue into the flow the user chose.
        router.replace("/(tabs)");
        router.push({ pathname: "/backup", params: flow === "buy" ? { next: "buy", asset: picked.symbol } : { next: "receive", chain: picked.chain } });
        return;
      }
      if (flow === "buy") {
        router.replace("/(tabs)");
        router.push({ pathname: "/buy", params: { asset: picked.symbol } });
      } else {
        setReceiveOpen(true);
      }
    } catch (e) {
      if (e instanceof WalletLimitError) {
        const when = e.reset ? new Date(e.reset).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "later";
        Alert.alert("Please try again later", `Wallet creation is limited to a few attempts per day. Try again after ${when}.`);
      } else if (!isUserCancelledError(e)) {
        Alert.alert("Couldn’t set up your wallet", describeTurnkeyError(e));
      }
    } finally {
      setBusy(null);
    }
  };

  const skip = () => {
    skipOnboarding();
    router.replace("/(tabs)");
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert("Sign out failed", error.message);
  };

  const action = (icon: React.ReactNode, title: string, sub: string, onPress: () => void, loading: boolean) => (
    <XStack
      onPress={busy ? undefined : onPress}
      alignItems='center'
      gap={12}
      paddingHorizontal={space.rowX}
      paddingVertical={14}
      pressStyle={{ backgroundColor: c.pressTint }}
      accessibilityRole='button'
      opacity={busy && !loading ? 0.5 : 1}
    >
      <IconBox size={36}>{icon}</IconBox>
      <YStack flex={1}>
        <UiText fontSize={15} fontWeight='600'>{loading ? "Confirm with your passkey…" : title}</UiText>
        <UiText fontSize={12} color={c.muted} marginTop={2}>{sub}</UiText>
      </YStack>
    </XStack>
  );

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <YStack paddingHorizontal={space.gutter} paddingTop={24} gap={space.section}>
            {picked ? (
              <XStack alignItems='center' gap={4} marginLeft={-8}>
                <XStack onPress={() => (busy ? undefined : setPicked(null))} width={44} height={44} alignItems='center' justifyContent='center' borderRadius={radius.iconBox} pressStyle={{ backgroundColor: c.iconPressTint }} accessibilityRole='button' accessibilityLabel='Choose a different asset'>
                  <ChevronLeft size={22} color={c.ink} strokeWidth={2} />
                </XStack>
                <UiText fontSize={13} color={c.muted}>Choose a different asset</UiText>
              </XStack>
            ) : null}

            <YStack gap={6}>
              <UiText fontSize={26} fontWeight='700' letterSpacing={tracking(26)}>
                {picked ? `Add ${picked.symbol}` : "What do you want to start with?"}
              </UiText>
              <UiText fontSize={15} color={c.muted} lineHeight={21}>
                {picked
                  ? hasChain(picked.chain)
                    ? `Your ${picked.chainName} address is ready. Buy ${picked.symbol} with a card, or receive it from another wallet.`
                    : `Your ${picked.chainName} wallet is created on the way — one passkey confirmation, secured by this phone. You’ll get a 12-word recovery phrase to write down.`
                  : `Signed in as ${user?.email ?? "you"}. Pick an asset — its wallet is created when you first buy or receive it.`}
              </UiText>
            </YStack>

            {!picked ? (
              <Card>
                {ASSETS.map((a, i) => (
                  <React.Fragment key={a.symbol}>
                    {i ? <Divider inset={0} /> : null}
                    <XStack
                      onPress={() => setPicked(a)}
                      alignItems='center'
                      gap={12}
                      paddingHorizontal={space.rowX}
                      paddingVertical={space.rowY}
                      pressStyle={{ backgroundColor: c.pressTint }}
                      accessibilityRole='button'
                    >
                      <AssetIcon symbol={a.symbol} size={36} fontSize='$3' />
                      <YStack flex={1}>
                        <UiText fontSize={15} fontWeight='600'>{a.symbol}</UiText>
                        <UiText fontSize={12} color={c.muted}>{a.name} · {a.chainName}</UiText>
                      </YStack>
                      {hasChain(a.chain) ? <UiText fontSize={11} color={c.positive} fontWeight='600'>Ready</UiText> : null}
                    </XStack>
                  </React.Fragment>
                ))}
              </Card>
            ) : (
              <Card>
                {action(<CreditCard size={18} color={c.ink} strokeWidth={1.8} />, `Buy ${picked.symbol}`, "Card, bank transfer or Apple Pay via Coinbase", () => void start("buy"), busy === "buy")}
                <Divider inset={0} />
                {action(<ArrowDownToLine size={18} color={c.ink} strokeWidth={1.8} />, `Receive ${picked.symbol}`, "Transfer from another wallet or exchange", () => void start("receive"), busy === "receive")}
              </Card>
            )}

            {!hasChain(picked?.chain ?? "stellar") && picked ? (
              <XStack alignItems='center' gap={8} justifyContent='center'>
                <Fingerprint size={14} color={c.faint} strokeWidth={1.8} />
                <UiText fontSize={12} color={c.faint}>One passkey prompt · nothing to write down</UiText>
              </XStack>
            ) : null}

            <YStack alignItems='center' gap={10} paddingTop={8}>
              {!wallet ? <PrimaryButton label='Skip for now' onPress={skip} disabled={!!busy} /> : null}
              <UiText fontSize={12} color={c.faint} textAlign='center'>You can add any asset later from the Assets tab.</UiText>
              <PillButton label='Sign out' onPress={() => void signOut()} />
            </YStack>
          </YStack>
        </ScrollView>
      </SafeAreaView>

      <ReceiveSheet
        open={receiveOpen}
        addresses={walletAddresses(wallet)}
        initialChain={picked?.chain}
        onClose={() => {
          setReceiveOpen(false);
          if (hasSkippedOnboarding()) router.replace("/(tabs)");
        }}
      />
    </Screen>
  );
}
