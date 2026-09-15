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
import { describeTurnkeyError } from "@/lib/turnkey/client";
import { apiFetch } from "@/lib/api";
import { ensureChainAddress } from "@/lib/turnkey/accounts";
import { createWalletWithPasskey } from "@/lib/turnkey/create-wallet";
import { markDeviceReady } from "@/lib/turnkey/device-ready";
import { useColors } from "@/lib/theme/appearance";
import { space, tracking } from "@/lib/theme/tokens";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

export default function CreateWalletScreen() {
  const c = useColors();
  const { user } = useSupabaseAuth();
  const { wallet, status, refetch, isLoading } = useTurnkeyWallet();
  const [creating, setCreating] = React.useState(false);
  // A sub-org that exists but has no Stellar account (web BTC/ETH-first user):
  // derive Stellar on the same seed — one passkey, no new wallet (CLAUDE.md §5).
  const addStellarOnly = status === "no-stellar" && !!wallet;

  const handleCreate = async () => {
    if (!user) return;
    setCreating(true);
    try {
      if (addStellarOnly && wallet) {
        await ensureChainAddress(wallet, "stellar");
        await refetch();
        return;
      }
      // Hard rule 15: check the wallet-link quota BEFORE the passkey ceremony —
      // the ceremony is irreversible (a passkey is minted on the device).
      const limit = await apiFetch<{ allowed: boolean; remaining: number; reset: number }>("/api/wallets/check-limit").catch(
        () => null
      );
      if (limit && limit.allowed === false) {
        const when = limit.reset ? new Date(limit.reset).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "later";
        Alert.alert("Please try again later", `Wallet creation is limited to a few attempts per day. Try again after ${when}.`);
        return;
      }
      // Passkey → POST turnkey/wallet { chain: 'stellar' } → link.
      await createWalletWithPasskey({ id: user.id, email: user.email });
      const { data } = await refetch(); // the tabs layout routes to Home once a wallet exists
      if (data?.subOrgId) await markDeviceReady(data.subOrgId); // the passkey was made right here
    } catch (e) {
      Alert.alert(addStellarOnly ? "Couldn’t add Stellar" : "Couldn’t create your wallet", describeTurnkeyError(e));
    } finally {
      setCreating(false);
    }
  };

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
              {addStellarOnly ? "Add Stellar to your wallet" : "Create your wallet"}
            </UiText>
            <UiText fontSize={14} color={c.muted}>
              {user?.email ? `Signed in as ${user.email}. ` : ""}
              {addStellarOnly
                ? "Your Normal wallet exists but has no Stellar account yet — savings and USDC live there."
                : "This account has no Normal wallet yet."}
            </UiText>
          </YStack>

          <Card padding={20} gap={14} alignItems='center'>
            <IconBox size={56}>
              <Fingerprint size={28} color={c.ink} strokeWidth={1.6} />
            </IconBox>
            <UiText fontSize={16} fontWeight='500' textAlign='center'>
              Secured by a passkey
            </UiText>
            <UiText fontSize={14} color={c.body50} textAlign='center' lineHeight={20}>
              Your wallet is protected by a passkey on this phone — no seed phrase to write
              down, nothing to lose.
            </UiText>
            <YStack width='100%' gap={8} marginTop={4}>
              <PrimaryButton label={addStellarOnly ? "Add Stellar" : "Create wallet"} onPress={handleCreate} loading={creating} />
              <UiText fontSize={11} color={c.faint} textAlign='center' fontFamily='$mono'>
                One passkey prompt · nothing to write down
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
