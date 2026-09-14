// #67 XLM fee semaphore — always visible once the account exists. Savings
// deposits/withdrawals are Soroban transactions paid in XLM above the reserve:
// green = buffer intact, amber = roughly one action left, red = actions paused.
// The action buttons key on the SAME status, so light and buttons never disagree.

import React from "react";
import { XStack, YStack } from "tamagui";
import { TriangleAlert } from "lucide-react-native";

import { UiText } from "@/components/home/primitives";
import { MIN_XLM_FOR_SOROBAN_TX, SAVINGS_XLM_BUFFER, type XlmFeeStatus } from "@/lib/stellar/send";
import { useColors } from "@/lib/theme/appearance";
import { radius } from "@/lib/theme/tokens";

export const FeeLight = ({ status, available }: { status: XlmFeeStatus; available: number }) => {
  const c = useColors();
  if (status === "ok") {
    return (
      <XStack alignItems='center' gap={8} paddingHorizontal={2}>
        <YStack width={8} height={8} borderRadius={4} backgroundColor={c.positive} />
        <UiText fontSize={12} color={c.muted}>
          XLM fee reserve healthy — deposits & withdrawals covered.
        </UiText>
      </XStack>
    );
  }
  const tone = status === "blocked" ? c.failed : c.chips.amber.color;
  const bg = status === "blocked" ? "rgba(220,38,38,0.08)" : c.chips.amber.bg;
  return (
    <XStack gap={10} padding={12} borderRadius={radius.input} backgroundColor={bg} alignItems='flex-start'>
      <TriangleAlert size={16} color={tone} strokeWidth={2} style={{ marginTop: 1 }} />
      <UiText fontSize={12.5} color={tone} flex={1} lineHeight={18}>
        {status === "blocked"
          ? `Savings actions are paused: only ${available.toFixed(2)} XLM is free for network fees. Receive at least ${MIN_XLM_FOR_SOROBAN_TX} XLM to continue.`
          : `XLM for fees is running low (${available.toFixed(2)} XLM free). Keep about ${SAVINGS_XLM_BUFFER} XLM spare so withdrawals always work.`}
      </UiText>
    </XStack>
  );
};
