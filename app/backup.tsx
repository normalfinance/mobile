// Your recovery phrase — web wallet-export-dialog.tsx in the app's idiom.
// Shown right after the first wallet is created (and from Home's card and
// Settings → Security any time). Reveal = one passkey; the words are shown
// in a numbered grid; a checkbox records the backup locally (web: no server
// record exists). Mobile does NOT block on the checkbox (Niko 2026-09-22):
// Done always continues; unticked = Home keeps offering the backup.
// Params: next=buy&asset=… | next=receive&chain=… (after Get started), else
// Done just goes back.

import React from "react";
import { Alert, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { XStack, YStack } from "tamagui";
import { Check, ChevronLeft, Eye, Fingerprint, TriangleAlert } from "lucide-react-native";

import { Card, IconBox, IconButton, Mono, PrimaryButton, Screen, SecondaryButton, UiText } from "@/components/home/primitives";
import { ReceiveSheet } from "@/components/home/ReceiveSheet";
import { CHAIN_META, useTurnkeyWallet, walletAddresses, type WalletChain } from "@/hooks/use-turnkey-wallet";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";
import { describeTurnkeyError, isUserCancelledError } from "@/lib/turnkey/client";
import { exportRecoveryPhrase, resolveExportWalletId } from "@/lib/turnkey/export";
import { markWalletBackedUp } from "@/lib/turnkey/provision";

const shorten = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function BackupScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ next?: string; asset?: string; chain?: string }>();
  const { wallet } = useTurnkeyWallet();
  const addresses = walletAddresses(wallet);
  const [words, setWords] = React.useState<string[] | null>(null);
  const [revealing, setRevealing] = React.useState(false);
  const [confirmed, setConfirmed] = React.useState(false);
  const [receiveOpen, setReceiveOpen] = React.useState(false);

  // The phrase never outlives this screen.
  React.useEffect(() => () => setWords(null), []);

  const reveal = async () => {
    if (!wallet?.subOrgId) return;
    setRevealing(true);
    try {
      const walletId = await resolveExportWalletId(wallet.walletId);
      setWords(await exportRecoveryPhrase(wallet.subOrgId, walletId));
    } catch (e) {
      if (!isUserCancelledError(e)) Alert.alert("Could not reveal the phrase", `${describeTurnkeyError(e)}\n\nNothing was exposed. You can try again.`);
    } finally {
      setRevealing(false);
    }
  };

  const done = async () => {
    if (confirmed && wallet?.subOrgId) await markWalletBackedUp(wallet.subOrgId);
    setWords(null);
    if (params.next === "buy") {
      router.replace("/(tabs)");
      router.push({ pathname: "/buy", params: { asset: params.asset ?? "USDC" } });
    } else if (params.next === "receive") {
      setReceiveOpen(true);
    } else if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <YStack paddingHorizontal={space.gutter} paddingTop={insets.top + 8} gap={20}>
          <XStack alignItems='center' gap={4} marginLeft={-10}>
            {!params.next ? (
              <IconButton onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} label='Back'>
                <ChevronLeft size={22} color={c.ink} strokeWidth={2} />
              </IconButton>
            ) : null}
            <UiText fontSize={22} fontWeight='600' letterSpacing={tracking(22)}>Your recovery phrase</UiText>
          </XStack>

          <XStack alignItems='flex-start' gap={8} padding={12} borderRadius={radius.input} backgroundColor={c.chips.amber.bg}>
            <TriangleAlert size={16} color={c.chips.amber.color} strokeWidth={2} />
            <UiText fontSize={13} color={c.chips.amber.color} flex={1} lineHeight={18}>
              Anyone with this phrase controls all your crypto. Write it down and keep it offline. Normal will never ask you for it.
            </UiText>
          </XStack>

          <Card padding={14} gap={10}>
            <UiText fontSize={13} color={c.muted} lineHeight={18}>
              One phrase — your whole wallet. It restores all of these:
            </UiText>
            {addresses.length ? (
              addresses.map((a) => (
                <XStack key={a.chain} alignItems='center' gap={8}>
                  <YStack width={8} height={8} borderRadius={4} backgroundColor={CHAIN_META[a.chain].color} />
                  <UiText fontSize={13} fontWeight='500' width={72}>{CHAIN_META[a.chain].name}</UiText>
                  <Mono fontSize={12} color={c.muted}>{shorten(a.address)}</Mono>
                </XStack>
              ))
            ) : (
              <UiText fontSize={13} color={c.faint}>No addresses yet.</UiText>
            )}
          </Card>

          {words ? (
            <Card padding={14} gap={12}>
              <XStack flexWrap='wrap' gap={8}>
                {words.map((w, i) => (
                  <XStack key={`${i}-${w}`} width='31%' alignItems='center' gap={8} paddingVertical={10} paddingHorizontal={10} borderRadius={radius.input} backgroundColor={c.inputBg}>
                    <Mono fontSize={11} color={c.faint}>{i + 1}</Mono>
                    <Mono fontSize={14} selectable={false}>{w}</Mono>
                  </XStack>
                ))}
              </XStack>
              <XStack
                onPress={() => setConfirmed((v) => !v)}
                alignItems='center'
                gap={10}
                paddingVertical={6}
                pressStyle={{ opacity: 0.6 }}
                accessibilityRole='checkbox'
                accessibilityState={{ checked: confirmed }}
              >
                <YStack width={22} height={22} borderRadius={6} borderWidth={1.5} borderColor={confirmed ? c.cta : c.borderStrong} backgroundColor={confirmed ? c.cta : "transparent"} alignItems='center' justifyContent='center'>
                  {confirmed ? <Check size={14} color={c.ctaText} strokeWidth={3} /> : null}
                </YStack>
                <UiText fontSize={14} fontWeight='500' flex={1}>I’ve written down my recovery phrase</UiText>
              </XStack>
            </Card>
          ) : (
            <Card padding={20} alignItems='center' gap={12}>
              <IconBox size={48}><Eye size={22} color={c.ink} strokeWidth={1.8} /></IconBox>
              <UiText fontSize={14} color={c.muted} textAlign='center' lineHeight={20}>
                Your phrase is stored encrypted with Turnkey. Revealing it needs your passkey and shows it only on this screen.
              </UiText>
              <YStack width='100%' gap={6}>
                <PrimaryButton label={revealing ? "Confirm with your passkey…" : "Reveal recovery phrase"} onPress={() => void reveal()} loading={revealing} />
                <XStack alignItems='center' gap={6} justifyContent='center'>
                  <Fingerprint size={13} color={c.faint} strokeWidth={1.8} />
                  <UiText fontSize={11} color={c.faint}>One passkey prompt · nothing leaves your phone</UiText>
                </XStack>
              </YStack>
            </Card>
          )}

          <YStack gap={8}>
            {words ? (
              <PrimaryButton label={params.next ? "Done — continue" : "Done"} onPress={() => void done()} />
            ) : params.next ? (
              <SecondaryButton label='Remind me later' onPress={() => void done()} borderRadius={radius.cta} />
            ) : null}
            {!confirmed && words ? (
              <UiText fontSize={12} color={c.faint} textAlign='center'>Not written down yet? Home will remind you until you tick the box.</UiText>
            ) : null}
          </YStack>
        </YStack>
      </ScrollView>

      <ReceiveSheet
        open={receiveOpen}
        addresses={addresses}
        initialChain={(params.chain as WalletChain | undefined) ?? addresses[0]?.chain}
        onClose={() => {
          setReceiveOpen(false);
          router.replace("/(tabs)");
        }}
      />
    </Screen>
  );
}
