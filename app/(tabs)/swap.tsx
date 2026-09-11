// Swap tab — shell only until the Turnkey wallet lands. Deliberately NOT the
// web swap card's density or inline asset picker (D12: the team is unhappy
// with those); this is the shape the real screen will keep.

import React from "react";
import { ScrollView } from "react-native";
import { XStack, YStack } from "tamagui";
import { ArrowDownUp, ChevronDown } from "lucide-react-native";

import { AssetIcon } from "@/components/ui/AssetIcon";
import {
  Card,
  IconBox,
  Mono,
  PrimaryButton,
  Screen,
  ScreenTitle,
  UiText
} from "@/components/home/primitives";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";

const AmountBox = ({ label, symbol }: { label: string; symbol: string }) => {
  const c = useColors();
  return (
    <YStack backgroundColor={c.inputBg} borderRadius={radius.input} padding={14} gap={10}>
      <UiText fontSize={12} color={c.muted}>
        {label}
      </UiText>
      <XStack alignItems='center' justifyContent='space-between'>
        <Mono fontSize={28} letterSpacing={tracking(28)} color={c.faint}>
          0.00
        </Mono>
        <XStack
          alignItems='center'
          gap={8}
          paddingVertical={6}
          paddingLeft={6}
          paddingRight={10}
          borderRadius={radius.pill}
          backgroundColor={c.surface}
          borderWidth={1}
          borderColor={c.border}
        >
          <AssetIcon symbol={symbol} size={24} fontSize='$2' />
          <UiText fontSize={14} fontWeight='600'>
            {symbol}
          </UiText>
          <ChevronDown size={16} color={c.muted} strokeWidth={2} />
        </XStack>
      </XStack>
    </YStack>
  );
};

export default function SwapScreen() {
  const c = useColors();
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 96 }}>
        <YStack paddingHorizontal={space.gutter} paddingTop={8} gap={space.section}>
          <ScreenTitle title='Swap' />

          <Card padding={12} gap={8}>
            <AmountBox label='You pay' symbol='XLM' />
            <XStack justifyContent='center' marginVertical={-14} zIndex={1}>
              <IconBox size={32} borderWidth={1} borderColor={c.border} backgroundColor={c.surface}>
                <ArrowDownUp size={16} color={c.ink} strokeWidth={2} />
              </IconBox>
            </XStack>
            <AmountBox label='You receive' symbol='USDC' />
            <YStack marginTop={6} gap={8}>
              <PrimaryButton label='Swap' disabled />
              <UiText fontSize={11} color={c.faint} textAlign='center' fontFamily='$mono'>
                Swaps arrive with the Normal wallet
              </UiText>
            </YStack>
          </Card>

          <UiText fontSize={13} color={c.muted} lineHeight={18}>
            Stellar swaps route through Soroswap. Bitcoin, Ethereum and Solana follow via LI.FI
            and Circle CCTP.
          </UiText>
        </YStack>
      </ScrollView>
    </Screen>
  );
}
