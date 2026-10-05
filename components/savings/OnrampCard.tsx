// Web sections/savings/savings-onramp-card.tsx: "Need USDC? Add funds to start
// earning." Deposit cash = MoneyGram (app/deposit-cash.tsx), Buy with card =
// Coinbase, Deposit crypto = Receive on USDC (walks funding + trustline first).

import React from "react";
import { XStack, YStack } from "tamagui";
import { ChevronRight, CreditCard, Landmark, Wallet } from "lucide-react-native";

import { Card, Divider, IconBox, UiText } from "@/components/home/primitives";
import { useColors } from "@/lib/theme/appearance";
import { space } from "@/lib/theme/tokens";

const Row = ({ Icon, label, description, onPress }: { Icon: typeof Landmark; label: string; description: string; onPress: () => void }) => {
  const c = useColors();
  return (
    <XStack
      onPress={onPress}
      padding={space.rowX}
      gap={space.rowGap}
      alignItems='center'
      pressStyle={{ backgroundColor: c.pressTint }}
      accessibilityRole='button'
      accessibilityLabel={label}
    >
      <IconBox size={36}>
        <Icon size={17} color={c.ink} strokeWidth={1.8} />
      </IconBox>
      <YStack flex={1} gap={2}>
        <UiText fontSize={14} fontWeight='600'>{label}</UiText>
        <UiText fontSize={12.5} color={c.muted}>{description}</UiText>
      </YStack>
      <ChevronRight size={18} color={c.faint} strokeWidth={2} />
    </XStack>
  );
};

export const OnrampCard = ({ onCash, onBuy, onReceive }: { onCash: () => void; onBuy: () => void; onReceive: () => void }) => {
  const c = useColors();
  return (
    <YStack gap={12}>
      <YStack gap={2}>
        <UiText fontSize={14} fontWeight='500' color={c.ink2}>Need USDC?</UiText>
        <UiText fontSize={12.5} color={c.muted}>Add funds to start earning.</UiText>
      </YStack>
      <Card>
        <Row Icon={Landmark} label='Deposit cash' description='At a MoneyGram location near you' onPress={onCash} />
        <Divider />
        <Row Icon={CreditCard} label='Buy with card' description='Debit card, Apple Pay or bank via Coinbase' onPress={onBuy} />
        <Divider />
        <Row Icon={Wallet} label='Deposit crypto' description='Send USDC from any external wallet' onPress={onReceive} />
      </Card>
    </YStack>
  );
};
