// Home token row shown INSTEAD of the USDC asset row until the Stellar
// account holds a USDC trustline (Niko 2026-10-13: a $0 USDC row before the
// trustline exists suggests the wallet can already receive USDC — it cannot).
// Same geometry as AssetRow; the right side is the next step, not a balance.

import React from "react";
import { XStack, YStack } from "tamagui";

import { AssetIcon } from "@/components/ui/AssetIcon";
import { assetDisplayName } from "@/lib/assets/names";
import type { SetupStep } from "@/lib/savings/engine";
import { useColors } from "@/lib/theme/appearance";
import { space, tracking, typeScale as t } from "@/lib/theme/tokens";
import { Chip, Pressable, UiText } from "./primitives";

export const UsdcSetupRow = ({ step, onPress }: { step: Exclude<SetupStep, "ready">; onPress: () => void }) => {
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
      accessibilityRole='button'
      accessibilityLabel='Set up USDC on Stellar'
    >
      <XStack alignItems='center' gap={space.rowGap} flex={1}>
        <AssetIcon symbol='USDC' size={36} fontSize='$3' />
        <YStack flex={1}>
          <UiText fontSize={t.assetName.size} fontWeight='600' letterSpacing={tracking(t.assetName.size)} lineHeight={18}>
            {assetDisplayName("USDC")}
          </UiText>
          <UiText fontSize={t.assetSub.size} color={c.muted} marginTop={2}>
            {step === "activate" ? "Needs a little XLM first, then a USDC trustline" : "Add the USDC trustline — one passkey"}
          </UiText>
        </YStack>
      </XStack>
      <Chip tone='amber' label='Set up' />
    </Pressable>
  );
};
