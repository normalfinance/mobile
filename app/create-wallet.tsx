// Shown when GET /api/turnkey/wallet returns { wallet: null } — a signed-in
// Supabase user who has no Turnkey sub-org yet.
//
// Stage C replaces the body of this screen with the passkey ceremony:
//   createPasskey() → POST /api/turnkey/wallet { challenge, attestation, chain: "stellar" }
//   → POST /api/wallets/link { address }                      (docs/web-agent-answers.md Q52, Q54)
// Nothing here may ever create a seed phrase on the device.

import React from "react";
import { Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Text, YStack } from "tamagui";

import { supabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";
import { useTurnkeyWallet } from "@/hooks/use-turnkey-wallet";

export default function CreateWalletScreen() {
  const { user } = useSupabaseAuth();
  const { refetch, isLoading } = useTurnkeyWallet();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert("Sign out failed", error.message);
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack
        flex={1}
        backgroundColor='$background'
        paddingHorizontal='$5'
        justifyContent='center'
        gap='$4'
      >
        <Text fontSize='$8' fontWeight='700'>
          Create your wallet
        </Text>
        <Text fontSize='$4' color='$gray11'>
          {user?.email ? `Signed in as ${user.email}. ` : ""}
          This account has no Normal wallet yet.
        </Text>
        <Text fontSize='$3' color='$gray10'>
          Wallet creation with Face ID (passkey) is the next build step. Until
          then, create your wallet on normalfinance.io with this same login and
          tap “Check again”.
        </Text>

        <Button
          onPress={() => void refetch()}
          disabled={isLoading}
          backgroundColor='#1C252E'
          borderRadius='$4'
        >
          <Text color='white' fontWeight='600'>
            {isLoading ? "Checking…" : "Check again"}
          </Text>
        </Button>

        <Button onPress={handleSignOut} chromeless>
          <Text color='$gray11'>Sign out</Text>
        </Button>
      </YStack>
    </SafeAreaView>
  );
}
