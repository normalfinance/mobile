// The drawer's balance card (connected-wallet.tsx:122-275): total, Assets /
// Savings rows separated by inset dividers, then the action tiles.

import React from "react";
import { XStack, YStack } from "tamagui";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Plus,
  type LucideIcon
} from "lucide-react-native";

import { ink, radius, space, tracking, typeScale as t } from "@/lib/theme/tokens";
import { fCurrencyTwoDecimals } from "@/lib/utils/number-format.utils";
import { Card, Divider, Mono, Skeleton, UiText } from "./primitives";

export type HomeAction = "receive" | "send" | "swap" | "buy";

interface BalanceCardProps {
  totalUsd: number;
  assetsUsd: number;
  savingsUsd?: number | null; // null = savings not wired yet
  isLoading?: boolean;
  onAction: (action: HomeAction) => void;
  onSavingsPress?: () => void;
}

const ACTIONS: { key: HomeAction; label: string; Icon: LucideIcon }[] = [
  { key: "receive", label: "Receive", Icon: ArrowDown },
  { key: "send", label: "Send", Icon: ArrowUp },
  { key: "swap", label: "Swap", Icon: ArrowLeftRight },
  { key: "buy", label: "Buy", Icon: Plus }
];

const Row = ({
  label,
  value,
  isLoading,
  onPress
}: {
  label: string;
  value: string;
  isLoading?: boolean;
  onPress?: () => void;
}) => (
  <XStack
    paddingHorizontal={space.rowX}
    paddingVertical={space.rowY}
    justifyContent='space-between'
    alignItems='center'
    borderRadius={radius.iconBox}
    onPress={onPress}
    pressStyle={onPress ? { backgroundColor: ink.pressTint } : undefined}
  >
    <UiText fontSize={t.rowLabel.size} color={ink.muted}>
      {label}
    </UiText>
    {isLoading ? (
      <Skeleton width={60} height={22} />
    ) : (
      <Mono fontSize={t.rowValue.size}>{value}</Mono>
    )}
  </XStack>
);

export const BalanceCard = ({
  totalUsd,
  assetsUsd,
  savingsUsd,
  isLoading,
  onAction,
  onSavingsPress
}: BalanceCardProps) => (
  <Card paddingTop={4} paddingHorizontal={4} paddingBottom={12}>
    {/* Total row */}
    <XStack
      paddingHorizontal={space.rowX}
      paddingTop={14}
      paddingBottom={space.rowY}
      justifyContent='space-between'
      alignItems='center'
    >
      <UiText fontSize={t.totalLabel.size} fontWeight='500' color={ink.ink2}>
        Total balance
      </UiText>
      {isLoading ? (
        <Skeleton width={110} height={28} />
      ) : (
        <Mono fontSize={t.total.size} letterSpacing={tracking(t.total.size)}>
          {fCurrencyTwoDecimals(totalUsd)}
        </Mono>
      )}
    </XStack>

    <Divider />
    <Row
      label='Assets'
      value={fCurrencyTwoDecimals(assetsUsd)}
      isLoading={isLoading}
    />
    <Divider />
    <Row
      label='Savings'
      value={
        savingsUsd === null || savingsUsd === undefined
          ? "—"
          : fCurrencyTwoDecimals(savingsUsd)
      }
      isLoading={isLoading}
      onPress={onSavingsPress}
    />

    {/* Action tiles — fixed row of four (D12: never a wrapping grid) */}
    <XStack gap={space.tileGap} marginTop={12} marginHorizontal={8}>
      {ACTIONS.map(({ key, label, Icon }) => (
        <YStack
          key={key}
          flex={1}
          onPress={() => onAction(key)}
          borderWidth={1}
          borderColor={ink.border}
          borderRadius={radius.tile}
          paddingVertical={12}
          paddingHorizontal={6}
          alignItems='center'
          gap={8}
          minHeight={space.touchTarget}
          pressStyle={{ backgroundColor: ink.pressTint, borderColor: ink.borderStrong }}
        >
          <YStack
            width={28}
            height={28}
            borderRadius={radius.iconBox}
            backgroundColor={ink.iconBg}
            alignItems='center'
            justifyContent='center'
          >
            <Icon size={16} color={ink.ink} strokeWidth={2} />
          </YStack>
          <UiText fontSize={t.actionLabel.size} fontWeight='500' color={ink.muted}>
            {label}
          </UiText>
        </YStack>
      ))}
    </XStack>
  </Card>
);
