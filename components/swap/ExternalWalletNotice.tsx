// Cross-chain (CCTP) swaps are Normal-wallet only — the Base pivot runs on the
// user's Turnkey ETH address (web agent, 2026-10-05: web moves USDC to the
// Normal wallet first, then swaps by passkey). Shown in place of the CCTP
// panels while an external Stellar wallet (LOBSTR …) occupies the slot.

import React from "react";
import { useRouter } from "expo-router";
import { XStack, YStack } from "tamagui";
import { Link2 } from "lucide-react-native";

import { Card, PillButton, UiText } from "@/components/home/primitives";
import { externalWalletLabel, type ExternalWallet } from "@/lib/external-wallet/store";
import { useColors } from "@/lib/theme/appearance";

export const ExternalWalletNotice = ({ external }: { external: ExternalWallet }) => {
  const c = useColors();
  const router = useRouter();
  return (
    <Card padding={16} gap={12}>
      <XStack alignItems='center' gap={10}>
        <Link2 size={18} color={c.ink} strokeWidth={1.8} />
        <UiText fontSize={15} fontWeight='600' flex={1}>Cross-chain swaps use your Normal wallet</UiText>
      </XStack>
      <UiText fontSize={13.5} color={c.muted} lineHeight={19}>
        You’re using {externalWalletLabel(external)} as your Stellar wallet. Swaps between Stellar and Bitcoin, Ethereum or Solana run through your Normal wallet’s addresses, so switch to it first — or send the USDC to your Normal wallet and swap from there. XLM ⇄ USDC swaps and Savings work directly from {externalWalletLabel(external)}.
      </UiText>
      <YStack alignItems='flex-start'>
        <PillButton label='Switch wallet in Settings' onPress={() => router.push("/(tabs)/settings")} />
      </YStack>
    </Card>
  );
};
