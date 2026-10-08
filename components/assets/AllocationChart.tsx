// Portfolio allocation donut for the Assets tab (Niko 2026-10-08): one slice
// per held asset by USD value, Normal Savings included as its own slice, the
// total in the middle, and a legend with each share. Same card idiom as the
// price chart; slice colours are the chain colours used everywhere else, so
// the ring reads like the asset rows below it.

import React from "react";
import { PieChart } from "react-native-gifted-charts";
import { XStack, YStack } from "tamagui";

import { Card, Mono, UiText } from "@/components/home/primitives";
import { useColors } from "@/lib/theme/appearance";
import { space } from "@/lib/theme/tokens";
import { fCurrency, fPercent } from "@/lib/utils/number-format.utils";

export interface AllocationSlice {
  key: string;
  label: string;
  usd: number;
  color: string;
}

export const ASSET_COLORS: Record<string, string> = {
  BTC: "#F7931A",
  ETH: "#627EEA",
  SOL: "#9945FF",
  XLM: "#14B8A6",
  USDC: "#2775CA",
  SAVINGS: "#1AB37D"
};

export const AllocationChart = ({ slices, isLoading }: { slices: AllocationSlice[]; isLoading?: boolean }) => {
  const c = useColors();
  const held = slices.filter((s) => s.usd > 0).sort((a, b) => b.usd - a.usd);
  const total = held.reduce((sum, s) => sum + s.usd, 0);
  if (!isLoading && total <= 0) return null;

  return (
    <Card paddingTop={14} paddingHorizontal={space.rowX} paddingBottom={14} gap={12}>
      <UiText fontSize={14} fontWeight='500' color={c.ink2}>Allocation</UiText>
      <XStack alignItems='center' gap={18}>
        <PieChart
          data={held.length ? held.map((s) => ({ value: s.usd, color: s.color })) : [{ value: 1, color: c.iconBg }]}
          donut
          radius={64}
          innerRadius={44}
          innerCircleColor={c.surface}
          strokeWidth={2}
          strokeColor={c.surface}
          isAnimated
          animationDuration={500}
          centerLabelComponent={() => (
            <YStack alignItems='center'>
              <Mono fontSize={13} fontWeight='600'>{isLoading && total <= 0 ? "—" : fCurrency(total)}</Mono>
              <UiText fontSize={10} color={c.muted}>total</UiText>
            </YStack>
          )}
        />
        <YStack flex={1} gap={8}>
          {held.map((s) => (
            <XStack key={s.key} alignItems='center' gap={8}>
              <YStack width={8} height={8} borderRadius={4} backgroundColor={s.color} />
              <UiText fontSize={13} flex={1} numberOfLines={1}>{s.label}</UiText>
              <Mono fontSize={12} color={c.muted}>{fPercent((s.usd / total) * 100, { maximumFractionDigits: 1 })}</Mono>
            </XStack>
          ))}
          {!held.length && isLoading ? <UiText fontSize={12} color={c.faint}>Loading…</UiText> : null}
        </YStack>
      </XStack>
    </Card>
  );
};
