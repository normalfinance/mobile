// Activity row from the drawer (activity-row.tsx:91-115 icon, :146-161 chips,
// :286 amount colour, :295-340 row). Positive amounts are the only green;
// everything else stays ink. Failed rows use the failed text colour.

import React from "react";
import { XStack, YStack } from "tamagui";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Minus,
  Plus,
  type LucideIcon
} from "lucide-react-native";

import { ink, space, typeScale as t, type ChipTone } from "@/lib/theme/tokens";
import { fAssetQuantity, fCurrency } from "@/lib/utils/number-format.utils";
import type { Transaction, TransactionType } from "@/services/portfolio.service";
import { Chip, Mono, Pressable, Skeleton, UiText } from "./primitives";

const TYPE_META: Record<
  TransactionType,
  { label: string; Icon: LucideIcon; tone: ChipTone; positive: boolean }
> = {
  receive: { label: "Received", Icon: ArrowDown, tone: "green", positive: true },
  send: { label: "Sent", Icon: ArrowUp, tone: "neutral", positive: false },
  swap: { label: "Swapped", Icon: ArrowLeftRight, tone: "blue", positive: false },
  buy: { label: "Bought", Icon: Plus, tone: "purple", positive: true },
  sell: { label: "Sold", Icon: Minus, tone: "amber", positive: false }
};

const formatWhen = (date: Date) =>
  date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
  " · " +
  date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

export const ActivityRow = ({
  tx,
  onPress
}: {
  tx: Transaction;
  onPress?: () => void;
}) => {
  const meta = TYPE_META[tx.type] ?? TYPE_META.send;
  const failed = tx.status === "failed";
  const pending = tx.status === "pending";
  const amountColor = failed ? ink.failed : meta.positive ? ink.positive : ink.ink;
  const prefix = meta.positive && !failed ? "+" : "";

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
      <XStack alignItems='center' gap={space.rowGap} flexShrink={1}>
        <YStack
          width={32}
          height={32}
          borderRadius={16}
          backgroundColor={ink.iconCircle}
          alignItems='center'
          justifyContent='center'
        >
          <meta.Icon size={16} color={ink.ink} strokeWidth={2} />
        </YStack>
        <YStack gap={3} flexShrink={1}>
          <XStack alignItems='center' gap={6}>
            <UiText fontSize={t.assetName.size} fontWeight='600' lineHeight={18}>
              {meta.label} {tx.asset}
            </UiText>
            {pending ? <Chip tone='amber' label='Pending' /> : null}
            {failed ? <Chip tone='neutral' label='Failed' /> : null}
          </XStack>
          <UiText fontSize={t.assetSub.size} color={ink.muted}>
            {formatWhen(tx.timestamp)}
          </UiText>
        </YStack>
      </XStack>
      <YStack alignItems='flex-end' gap={2}>
        <Mono fontSize={t.assetUsd.size} color={amountColor}>
          {prefix}
          {fAssetQuantity(tx.amount, tx.asset)} {tx.asset}
        </Mono>
        {tx.usdValue ? (
          <Mono fontSize={t.assetQty.size} color={ink.muted}>
            {fCurrency(tx.usdValue)}
          </Mono>
        ) : null}
      </YStack>
    </Pressable>
  );
};

export const ActivityRowSkeleton = () => (
  <XStack
    paddingVertical={space.rowY}
    paddingHorizontal={8}
    alignItems='center'
    justifyContent='space-between'
  >
    <XStack alignItems='center' gap={space.rowGap}>
      <Skeleton width={32} height={32} circle />
      <YStack gap={6}>
        <Skeleton width={110} height={14} />
        <Skeleton width={80} height={12} />
      </YStack>
    </XStack>
    <Skeleton width={84} height={14} />
  </XStack>
);
