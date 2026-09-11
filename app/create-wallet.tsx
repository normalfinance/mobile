// Shown when GET /api/turnkey/wallet returns { wallet: null } — a signed-in
// Supabase user who has no Turnkey sub-org yet.
//
// Stage C replaces the CTA with the passkey ceremony:
//   createPasskey() → POST /api/turnkey/wallet { challenge, attestation, chain: "stellar" }
//   → POST /api/wallets/link { address }                      (docs/web-agent-answers.md Q52, Q54)
// Nothing here may ever create a seed phrase on the device.

import React from "react";
import { Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { YStack } from "tamagui";
import { Fingerprint } from "lucide-react-native";

import {
  Card,
  IconBox,
  PillButton,
  PrimaryButton,
  Screen,
  UiText
} from "@/components/home/primitives";
import { useTurnkeyWallet } from "@/hooks/use-turnkey-wallet";
import { supabase } from "@/lib/supabase";
import { useColors } from "@/lib/theme/appearance";
import { space, tracking } from "@/lib/theme/tokens";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

export default function CreateWalletScreen() {
  const c = useColors();
  const { user } = useSupabaseAuth();
  const { refetch, isLoading } = useTurnkeyWallet();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert("Sign out failed", error.message);
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} paddingHorizontal={space.gutter} justifyContent='center' gap={20}>
          <YStack gap={6}>
            <UiText fontSize={22} fontWeight='600' letterSpacing={tracking(22)}>
              Create your wallet
            </UiText>
            <UiText fontSize={14} color={c.muted}>
              {user?.email ? `Signed in as ${user.email}. ` : ""}
              This account has no Normal wallet yet.
            </UiText>
          </YStack>

          <Card padding={20} gap={14} alignItems='center'>
            <IconBox size={56}>
              <Fingerprint size={28} color={c.ink} strokeWidth={1.6} />
            </IconBox>
            <UiText fontSize={16} fontWeight='500' textAlign='center'>
              Secured by Face ID
            </UiText>
            <UiText fontSize={14} color={c.body50} textAlign='center' lineHeight={20}>
              Your wallet is protected by a passkey on this phone — no seed phrase to write
              down, nothing to lose.
            </UiText>
            <YStack width='100%' gap={8} marginTop={4}>
              <PrimaryButton label='Create wallet' disabled />
              <UiText fontSize={11} color={c.faint} textAlign='center' fontFamily='$mono'>
                Passkey wallet creation is the next build step
              </UiText>
            </YStack>
          </Card>

          <UiText fontSize={13} color={c.muted} textAlign='center' lineHeight={18}>
            Already created a wallet on normalfinance.io with this login? Tap below.
          </UiText>
          <YStack alignItems='center' gap={10}>
            <PillButton label={isLoading ? "Checking…" : "Check again"} onPress={() => void refetch()} />
            <PillButton label='Sign out' onPress={handleSignOut} />
          </YStack>
        </YStack>
      </SafeAreaView>
    </Screen>
  );
}
