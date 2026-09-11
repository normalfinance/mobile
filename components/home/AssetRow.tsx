// Asset row from the drawer's Tokens tab (tokens-tab.tsx:95-140):
// 36px icon · name 14/600 · sub 12 muted   |   usd 14 mono · qty 11.5 mono muted

import React from "react";
import { XStack, YStack } from "tamagui";

import { AssetIcon } from "@/components/ui/AssetIcon";
import { useColors } from "@/lib/theme/appearance";
import { space, tracking, typeScale as t } from "@/lib/theme/tokens";
import { fAssetQuantity, fCurrency } from "@/lib/utils/number-format.utils";
import type { AssetWithPrice } from "@/services/portfolio.service";
import { Mono, Pressable, Skeleton, UiText } from "./primitives";

export const AssetRow = ({
  asset,
  onPress
}: {
  asset: AssetWithPrice;
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
        <AssetIcon symbol={asset.asset_code} size={36} fontSize='$3' />
        <YStack>
          <UiText
            fontSize={t.assetName.size}
            fontWeight='600'
            letterSpacing={tracking(t.assetName.size)}
            lineHeight={18}
          >
            {asset.asset_code}
          </UiText>
          <UiText fontSize={t.assetSub.size} color={c.muted} marginTop={2}>
            {asset.display_name}
          </UiText>
        </YStack>
      </XStack>
      <YStack alignItems='flex-end'>
        <Mono fontSize={t.assetUsd.size}>{fCurrency(asset.usdValue)}</Mono>
        <Mono fontSize={t.assetQty.size} color={c.muted} marginTop={2}>
          {fAssetQuantity(asset.balance, asset.asset_code)} {asset.asset_code}
        </Mono>
      </YStack>
    </Pressable>
  );
};

export const AssetRowSkeleton = () => (
  <XStack
    paddingVertical={space.rowY}
    paddingHorizontal={8}
    alignItems='center'
    justifyContent='space-between'
  >
    <XStack alignItems='center' gap={space.rowGap}>
      <Skeleton width={36} height={36} circle />
      <YStack gap={6}>
        <Skeleton width={64} height={14} />
        <Skeleton width={96} height={12} />
      </YStack>
    </XStack>
    <YStack alignItems='flex-end' gap={6}>
      <Skeleton width={72} height={14} />
      <Skeleton width={56} height={11} />
    </YStack>
  </XStack>
);
