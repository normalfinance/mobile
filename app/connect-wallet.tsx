// Connect an external Stellar wallet over WalletConnect (web: Stellar Wallets
// Kit's picker → LOBSTR / WalletConnect). Starts a pairing, opens the wallet
// app with it (LOBSTR deep link) or shows the pairing QR for a wallet on
// another device, waits for approval, links the address server-side (3 per
// 24 h, like web) and makes it the active Stellar wallet.

import React from "react";
import { Alert, Linking, ScrollView } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { XStack, YStack } from "tamagui";
import { Check, ChevronLeft, Copy, ExternalLink, Link2 } from "lucide-react-native";

import { Card, IconButton, Mono, PillButton, PrimaryButton, Screen, SecondaryButton, UiText } from "@/components/home/primitives";
import { ensureWalletLinked, WalletLinkLimitError } from "@/lib/external-wallet/link";
import { setExternalWallet, type ExternalWalletType } from "@/lib/external-wallet/store";
import { disconnectWalletConnect, openWalletApp, startConnect, type ConnectHandle } from "@/lib/external-wallet/walletconnect";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";
import { shortenAddress } from "@/lib/utils/number-format.utils";

const LOBSTR_STORE = { ios: "https://apps.apple.com/us/app/lobstr-stellar-wallet/id1404357892", android: "https://play.google.com/store/apps/details?id=com.lobstr.client" };

export default function ConnectWalletScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ wallet?: string }>();
  const walletType: ExternalWalletType = params.wallet === "wallet-connect" ? "wallet-connect" : "lobstr";
  const title = walletType === "lobstr" ? "Connect LOBSTR" : "Connect a wallet";

  const [handle, setHandle] = React.useState<ConnectHandle | null>(null);
  const [phase, setPhase] = React.useState<"starting" | "waiting" | "linking" | "done" | "error">("starting");
  const [error, setError] = React.useState<string | null>(null);
  const [showQr, setShowQr] = React.useState(walletType === "wallet-connect");
  const [opened, setOpened] = React.useState<boolean | null>(null);
  const [copied, setCopied] = React.useState(false);
  const attempt = React.useRef(0);

  const begin = React.useCallback(async () => {
    const my = ++attempt.current;
    setPhase("starting");
    setError(null);
    try {
      const h = await startConnect();
      if (my !== attempt.current) return;
      setHandle(h);
      setPhase("waiting");
      if (walletType === "lobstr") setOpened(await openWalletApp("lobstr", h.uri));
      const approved = await h.approval();
      if (my !== attempt.current) return;
      setPhase("linking");
      const name = walletType === "lobstr" ? "LOBSTR" : approved.name;
      try {
        await ensureWalletLinked(approved.address, name);
      } catch (e) {
        await disconnectWalletConnect(approved.topic);
        throw e;
      }
      await setExternalWallet({ address: approved.address, walletType, name: approved.name, topic: approved.topic, connectedAt: Date.now() });
      // Everything keyed by the Stellar address re-reads for the new wallet.
      void queryClient.invalidateQueries();
      setPhase("done");
      Alert.alert(`${name} connected`, `Normal now shows and signs for\n${approved.address}\n\nSwitch back to your Normal wallet any time in Settings.`, [{ text: "Continue", onPress: () => router.replace("/(tabs)") }]);
    } catch (e) {
      if (my !== attempt.current) return;
      setPhase("error");
      setError(e instanceof WalletLinkLimitError ? e.message : e instanceof Error ? e.message : "The connection was not approved.");
    }
  }, [walletType, queryClient, router]);

  React.useEffect(() => {
    void begin();
    return () => {
      attempt.current += 1;
    };
  }, [begin]);

  const copy = async () => {
    if (!handle) return;
    await Clipboard.setStringAsync(handle.uri);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <YStack paddingHorizontal={space.gutter} paddingTop={insets.top + 8} gap={16}>
          <XStack alignItems='center' gap={4} marginLeft={-10}>
            <IconButton onPress={() => router.back()} label='Back'><ChevronLeft size={22} color={c.ink} strokeWidth={2} /></IconButton>
            <UiText fontSize={22} fontWeight='600' letterSpacing={tracking(22)}>{title}</UiText>
          </XStack>

          <Card padding={16} gap={12}>
            <XStack alignItems='center' gap={10}>
              <Link2 size={18} color={c.ink} strokeWidth={1.8} />
              <UiText fontSize={15} fontWeight='600' flex={1}>
                {phase === "starting" ? "Preparing the connection…" : phase === "waiting" ? (walletType === "lobstr" ? "Approve in LOBSTR" : "Approve in your wallet") : phase === "linking" ? "Linking the wallet to your account…" : phase === "done" ? "Connected" : "Couldn’t connect"}
              </UiText>
            </XStack>
            <UiText fontSize={13.5} color={c.muted} lineHeight={19}>
              {phase === "waiting" && walletType === "lobstr"
                ? opened === false
                  ? "LOBSTR doesn’t seem to be installed on this phone. Install it, or scan the QR code below with LOBSTR on another device."
                  : "LOBSTR should have opened with a connection request. Approve it there, then come back to Normal. Your keys never leave LOBSTR — Normal asks it to sign each transaction."
                : phase === "waiting"
                  ? "Scan the QR code with a Stellar wallet that supports WalletConnect, or copy the link into it, and approve the connection."
                  : phase === "error"
                    ? error
                    : "One moment."}
            </UiText>
            {phase === "waiting" && walletType === "lobstr" ? (
              <XStack gap={8} flexWrap='wrap'>
                <PillButton label='Open LOBSTR again' onPress={() => handle && void openWalletApp("lobstr", handle.uri)} />
                <PillButton label={showQr ? "Hide QR code" : "Wallet on another device?"} onPress={() => setShowQr((v) => !v)} />
                {opened === false ? <PillButton label='Get LOBSTR' onPress={() => void Linking.openURL(LOBSTR_STORE.ios)} /> : null}
              </XStack>
            ) : null}
            {phase === "error" ? <PrimaryButton label='Try again' onPress={() => void begin()} /> : null}
          </Card>

          {phase === "waiting" && handle && showQr ? (
            <Card padding={16} gap={12} alignItems='center'>
              <YStack padding={16} borderRadius={radius.card} backgroundColor='#FAFAFB'>
                <QRCode value={handle.uri} size={200} backgroundColor='#FAFAFB' />
              </YStack>
              <UiText fontSize={12} color={c.muted} textAlign='center'>WalletConnect pairing code · expires in a few minutes</UiText>
              <SecondaryButton label={copied ? "Copied" : "Copy connection link"} icon={copied ? <Check size={16} color={c.positive} strokeWidth={2} /> : <Copy size={16} color={c.ink} strokeWidth={2} />} onPress={() => void copy()} />
            </Card>
          ) : null}

          <Card padding={14} gap={8}>
            <UiText fontSize={14} fontWeight='600'>What this changes</UiText>
            <UiText fontSize={13} color={c.muted} lineHeight={18}>Your connected wallet becomes the Stellar wallet in Normal: its XLM, USDC and savings show here, and savings deposits, sends and swaps are signed in {walletType === "lobstr" ? "LOBSTR" : "that wallet"} instead of with your passkey.</UiText>
            <UiText fontSize={13} color={c.muted} lineHeight={18}>Bitcoin, Ethereum and Solana stay on your Normal wallet. You can switch back in Settings at any time.</UiText>
            {walletType === "lobstr" ? (
              <XStack alignItems='center' gap={6} paddingTop={2}>
                <ExternalLink size={12} color={c.faint} strokeWidth={2} />
                <Mono fontSize={11} color={c.faint}>lobstr.co · WalletConnect</Mono>
              </XStack>
            ) : null}
          </Card>
          {phase === "done" ? <UiText fontSize={12} color={c.muted} textAlign='center'>{shortenAddress("", 4, 4)}</UiText> : null}
        </YStack>
      </ScrollView>
    </Screen>
  );
}
