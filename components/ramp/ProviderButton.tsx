// Branded on/off-ramp buttons (Niko 2026-10-11): Coinbase blue, MoneyGram
// red, Stripe purple, each with its logo in a white disc on the left. Same
// geometry as PrimaryButton (height, radius, Satoshi 15/600) so they sit in
// the same stacks; the one place the app's ink-only rule for solid buttons is
// deliberately broken, because the colour IS the information here.

import React from "react";
import { ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { XStack, YStack } from "tamagui";

import { UiText } from "@/components/home/primitives";
import { radius } from "@/lib/theme/tokens";

export type RampProvider = "coinbase" | "moneygram" | "stripe";

const BRAND: Record<RampProvider, { bg: string; pressed: string; logo: number | null; letter: string }> = {
  coinbase: { bg: "#0052FF", pressed: "#0041CC", logo: require("@/assets/images/providers/coinbase.png"), letter: "C" },
  moneygram: { bg: "#DA291C", pressed: "#B82116", logo: require("@/assets/images/providers/moneygram.webp"), letter: "M" },
  stripe: { bg: "#635BFF", pressed: "#4F47D9", logo: null, letter: "S" }
};

export const ProviderButton = ({
  provider,
  label,
  onPress,
  disabled,
  loading
}: {
  provider: RampProvider;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) => {
  const b = BRAND[provider];
  const inert = disabled || loading;
  return (
    <XStack
      onPress={inert ? undefined : onPress}
      height={52}
      borderRadius={radius.cta}
      backgroundColor={b.bg}
      opacity={disabled && !loading ? 0.45 : 1}
      alignItems='center'
      justifyContent='center'
      gap={10}
      paddingHorizontal={16}
      pressStyle={{ backgroundColor: b.pressed }}
      accessibilityRole='button'
      accessibilityState={{ disabled: !!inert }}
      accessibilityLabel={label}
    >
      <YStack width={26} height={26} borderRadius={13} backgroundColor='#FFFFFF' alignItems='center' justifyContent='center' overflow='hidden'>
        {b.logo ? (
          <Image source={b.logo} style={{ width: 26, height: 26 }} contentFit='cover' />
        ) : (
          <UiText fontSize={15} fontWeight='700' color={b.bg}>{b.letter}</UiText>
        )}
      </YStack>
      {loading ? <ActivityIndicator color='#FFFFFF' /> : null}
      <UiText fontSize={15} fontWeight='600' color='#FFFFFF'>{label}</UiText>
    </XStack>
  );
};
