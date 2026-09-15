// Settings — account, appearance (light / dark / system), about, sign out.

import React from "react";
import { Alert, ScrollView } from "react-native";
import Constants from "expo-constants";
import * as Clipboard from "expo-clipboard";
import { XStack, YStack } from "tamagui";
import { useRouter } from "expo-router";
import {
  Check,
  Copy,
  Fingerprint,
  LogOut,
  Mail,
  Moon,
  ShieldCheck,
  Smartphone,
  Sun,
  Wallet
} from "lucide-react-native";

import {
  Card,
  Divider,
  ListRow,
  Mono,
  Screen,
  ScreenTitle,
  SecondaryButton,
  UiText
} from "@/components/home/primitives";
import { CHAIN_META, useTurnkeyWallet, type WalletChain } from "@/hooks/use-turnkey-wallet";
import { supabase } from "@/lib/supabase";
import { useAppearance, useColors, type AppearanceMode } from "@/lib/theme/appearance";
import { space } from "@/lib/theme/tokens";
import { shortenAddress } from "@/lib/utils/number-format.utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Zap } from "lucide-react-native";
import { Chip } from "@/components/home/primitives";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { autopilotAvailable, fetchAutopilotStatus, grantAutopilotConsent, revokeAutopilotConsent } from "@/lib/turnkey/autopilot";
import { describeTurnkeyError, isNoPasskeyError, isUserCancelledError } from "@/lib/turnkey/client";
import { verifyDevicePasskey } from "@/lib/turnkey/device-check";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

const APPEARANCE: { key: AppearanceMode; label: string; Icon: typeof Sun }[] = [
  { key: "light", label: "Light", Icon: Sun },
  { key: "dark", label: "Dark", Icon: Moon },
  { key: "system", label: "System", Icon: Smartphone }
];

export default function SettingsScreen() {
  const c = useColors();
  const { mode, setMode } = useAppearance();
  const { user } = useSupabaseAuth();
  const { addresses, wallet } = useTurnkeyWallet();
  const router = useRouter();
  const [testing, setTesting] = React.useState(false);

  // Autopilot (single-signature cross-chain swaps): truth is Turnkey via the
  // status route; enable = the consent ceremony, disable = delete the delegate.
  const queryClient = useQueryClient();
  const autopilot = useQuery({ queryKey: ["autopilot", "status"], queryFn: fetchAutopilotStatus, enabled: autopilotAvailable() && !!wallet, staleTime: 60_000 });
  const [autopilotBusy, setAutopilotBusy] = React.useState(false);
  const toggleAutopilot = () => {
    if (!wallet?.subOrgId) return;
    const active = autopilot.data?.active === true;
    const run = async () => {
      setAutopilotBusy(true);
      try {
        if (active) {
          if (!autopilot.data?.autopilotUserId) throw new Error("No autopilot user found.");
          await revokeAutopilotConsent(wallet.subOrgId, autopilot.data.autopilotUserId);
        } else {
          await grantAutopilotConsent(wallet.subOrgId);
          // Un-suppress the swap-time offer the user once declined (web).
          await AsyncStorage.removeItem("autopilot_declined_v1").catch(() => undefined);
        }
        await queryClient.invalidateQueries({ queryKey: ["autopilot", "status"] });
      } catch (e) {
        if (!isUserCancelledError(e)) Alert.alert(active ? "Couldn’t turn off" : "Couldn’t turn on", describeTurnkeyError(e));
      } finally {
        setAutopilotBusy(false);
      }
    };
    if (active) {
      Alert.alert("Turn off automatic completion?", "Cross-chain swaps will need a second passkey confirmation after the bridge again. One confirmation to turn off.", [
        { text: "Cancel", style: "cancel" },
        { text: "Turn off", style: "destructive", onPress: () => void run() }
      ]);
    } else {
      Alert.alert(
        "Turn on automatic completion?",
        "Normal finishes the Base step of cross-chain swaps for you, so you confirm once at the start. Allowed: Base-network transactions to Circle, USDC and LI.FI only, enforced by your wallet’s policy. One or two passkey confirmations.",
        [{ text: "Cancel", style: "cancel" }, { text: "Turn on", onPress: () => void run() }]
      );
    }
  };

  // Proves passkey → Turnkey → ed25519 end to end. Signs a no-op Stellar
  // transaction and verifies the signature locally; nothing is submitted.
  const testSigning = async () => {
    if (!wallet?.subOrgId || !wallet.stellarAddress) {
      Alert.alert("No Stellar wallet", "This account has no Stellar address to sign with.");
      return;
    }
    setTesting(true);
    try {
      const r = await verifyDevicePasskey(wallet.subOrgId, wallet.stellarAddress);
      Alert.alert(r.ok ? "Signature valid ✓" : "Signature check failed", `${r.detail}\n\n${r.ms} ms`);
    } catch (e) {
      if (isNoPasskeyError(e)) {
        Alert.alert(
          "No passkey on this phone",
          "Your wallet’s passkey lives on another device. Set up this phone with an email code.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Set up this phone", onPress: () => router.push("/setup-device") }
          ]
        );
      } else {
        Alert.alert("Signing failed", describeTurnkeyError(e));
      }
    } finally {
      setTesting(false);
    }
  };
  const [copiedChain, setCopiedChain] = React.useState<WalletChain | null>(null);

  const copyAddress = async (chain: WalletChain, address: string) => {
    await Clipboard.setStringAsync(address);
    setCopiedChain(chain);
    setTimeout(() => setCopiedChain((cur) => (cur === chain ? null : cur)), 2000);
  };

  const signOut = () => {
    Alert.alert("Sign out", "You can sign back in with the same email any time.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.auth.signOut();
          if (error) Alert.alert("Sign out failed", error.message);
        }
      }
    ]);
  };

  const version = Constants.expoConfig?.version ?? "—";

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 96 }}>
        <YStack paddingHorizontal={space.gutter} paddingTop={8} gap={space.section}>
          <ScreenTitle title='Settings' />

          <YStack gap={10}>
            <UiText fontSize={13} color={c.muted}>
              Account
            </UiText>
            <Card>
              <ListRow
                icon={<Mail size={16} color={c.ink} strokeWidth={1.8} />}
                label='Email'
                sub={user?.email ?? "—"}
              />
            </Card>
          </YStack>

          {/* One row per chain the wallet has an address for (lazy creation: a
              chain appears here the first time it is used). Tap to copy. */}
          <YStack gap={10}>
            <UiText fontSize={13} color={c.muted}>
              Wallet addresses
            </UiText>
            <Card>
              {addresses.length === 0 ? (
                <ListRow
                  icon={<Wallet size={16} color={c.ink} strokeWidth={1.8} />}
                  label='No addresses yet'
                  sub='Addresses are created the first time you use an asset.'
                />
              ) : (
                addresses.map(({ chain, address }, i) => (
                  <React.Fragment key={chain}>
                    {i > 0 ? <Divider /> : null}
                    <ListRow
                      icon={
                        <YStack
                          width={10}
                          height={10}
                          borderRadius={5}
                          backgroundColor={CHAIN_META[chain].color}
                        />
                      }
                      label={CHAIN_META[chain].name}
                      sub={CHAIN_META[chain].assets}
                      right={
                        <XStack alignItems='center' gap={8}>
                          <Mono fontSize={12} color={c.muted}>
                            {shortenAddress(address, 6, 6)}
                          </Mono>
                          {copiedChain === chain ? (
                            <Check size={16} color={c.positive} strokeWidth={2} />
                          ) : (
                            <Copy size={16} color={c.muted} strokeWidth={2} />
                          )}
                        </XStack>
                      }
                      onPress={() => void copyAddress(chain, address)}
                    />
                  </React.Fragment>
                ))
              )}
            </Card>
          </YStack>

          <YStack gap={10}>
            <UiText fontSize={13} color={c.muted}>
              Security
            </UiText>
            <Card>
              <ListRow
                icon={<Fingerprint size={16} color={c.ink} strokeWidth={1.8} />}
                label='Set up this phone'
                sub='Add a passkey for this device to your wallet'
                onPress={() => router.push("/setup-device")}
              />
              <Divider />
              <ListRow
                icon={<ShieldCheck size={16} color={c.ink} strokeWidth={1.8} />}
                label={testing ? "Testing…" : "Test signing"}
                sub='Signs a random digest with your passkey and verifies it. Nothing is sent.'
                onPress={testing ? undefined : testSigning}
              />
              {autopilotAvailable() ? (
                <>
                  <Divider />
                  <ListRow
                    icon={<Zap size={16} color={c.ink} strokeWidth={1.8} />}
                    label={autopilotBusy ? "Working…" : "Automatic swap completion"}
                    sub={autopilot.data?.active ? "Cross-chain swaps finish by themselves after one confirmation" : "Finish cross-chain swaps with a single confirmation"}
                    right={
                      <Chip
                        tone={autopilot.data?.active ? "green" : autopilot.data?.reason === "unknown" ? "amber" : "neutral"}
                        // A failed status read is "Unknown", never a claimed "Off" (web).
                        label={autopilot.isLoading ? "…" : autopilot.data?.active ? "On" : autopilot.data?.reason === "unknown" ? "Unknown" : "Off"}
                      />
                    }
                    onPress={autopilotBusy ? undefined : toggleAutopilot}
                  />
                </>
              ) : null}
            </Card>
          </YStack>

          <YStack gap={10}>
            <UiText fontSize={13} color={c.muted}>
              Appearance
            </UiText>
            <Card>
              {APPEARANCE.map(({ key, label, Icon }, i) => (
                <React.Fragment key={key}>
                  {i > 0 ? <Divider /> : null}
                  <ListRow
                    icon={<Icon size={16} color={c.ink} strokeWidth={1.8} />}
                    label={label}
                    right={mode === key ? <Check size={18} color={c.ink} strokeWidth={2} /> : undefined}
                    onPress={() => setMode(key)}
                  />
                </React.Fragment>
              ))}
            </Card>
          </YStack>

          <YStack gap={10}>
            <UiText fontSize={13} color={c.muted}>
              About
            </UiText>
            <Card>
              <ListRow label='Version' right={<Mono fontSize={12} color={c.muted}>{version}</Mono>} />
              <Divider />
              <ListRow label='Network' right={<Mono fontSize={12} color={c.muted}>Stellar mainnet</Mono>} />
            </Card>
          </YStack>

          <SecondaryButton
            label='Sign out'
            onPress={signOut}
            icon={<LogOut size={16} color={c.ink} strokeWidth={1.8} />}
          />
        </YStack>
      </ScrollView>
    </Screen>
  );
}
