// "Normal Savings" as a token-list row (web account-drawer.tsx:123-145):
// logo icon, $1-pegged, shown only while the position is > 0 — never a
// confident $0 row. Tapping opens the Savings tab.

import React from "react";
import { Image } from "expo-image";
import { XStack, YStack } from "tamagui";

import { useColors } from "@/lib/theme/appearance";
import { space, tracking, typeScale as t } from "@/lib/theme/tokens";
import { BRAND_ASSETS } from "@/lib/utils/cdn.utils";
import { fCurrency, fNumber } from "@/lib/utils/number-format.utils";
import { Mono, Pressable, UiText } from "./primitives";

export const SavingsRow = ({
  value,
  apy,
  onPress
}: {
  value: number;
  apy: number | null;
  onPress?: () => void;
}) => {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      paddingVertical={space.rowY}
      paddingHorizontal={8}
      flexDirection='row'
      alignItems='center'
      justifyContent='space-between'
      minHeight={space.touchTarget}
    >
      <XStack alignItems='center' gap={space.rowGap}>
        <YStack width={36} height={36} borderRadius={18} overflow='hidden' backgroundColor={c.iconBg}>
          <Image source={{ uri: BRAND_ASSETS.logoSinglePng() }} style={{ width: 36, height: 36 }} contentFit='cover' cachePolicy='memory-disk' />
        </YStack>
        <YStack>
          <UiText fontSize={t.assetName.size} fontWeight='600' letterSpacing={tracking(t.assetName.size)} lineHeight={18}>
            Savings
          </UiText>
          <UiText fontSize={t.assetSub.size} color={c.muted} marginTop={2}>
            Normal Savings{apy !== null ? ` · ${apy.toFixed(2)}% APY` : ""}
          </UiText>
        </YStack>
      </XStack>
      <YStack alignItems='flex-end'>
        <Mono fontSize={t.assetUsd.size}>{fCurrency(value)}</Mono>
        <Mono fontSize={t.assetQty.size} color={c.muted} marginTop={2}>
          {fNumber(value, { maximumFractionDigits: 2 })} USDC
        </Mono>
      </YStack>
    </Pressable>
  );
};
