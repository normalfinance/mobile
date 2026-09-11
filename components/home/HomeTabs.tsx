// Drawer tabs (connected-wallet.tsx:276-300): 13.5/500 muted, selected ink,
// 2px ink indicator, 1px bottom border, no uppercase.

import React from "react";
import { XStack, YStack } from "tamagui";

import { ink, typeScale as t } from "@/lib/theme/tokens";
import { UiText } from "./primitives";

export type HomeTab = "tokens" | "activity";

const TABS: { key: HomeTab; label: string }[] = [
  { key: "tokens", label: "Tokens" },
  { key: "activity", label: "Activity" }
];

export const HomeTabs = ({
  value,
  onChange
}: {
  value: HomeTab;
  onChange: (tab: HomeTab) => void;
}) => (
  <XStack borderBottomWidth={1} borderBottomColor={ink.border} gap={4}>
    {TABS.map(({ key, label }) => {
      const selected = value === key;
      return (
        <YStack
          key={key}
          onPress={() => onChange(key)}
          paddingHorizontal={14}
          paddingTop={10}
          paddingBottom={8}
          minHeight={44}
          justifyContent='flex-end'
          pressStyle={{ opacity: 0.7 }}
        >
          <UiText
            fontSize={t.tab.size}
            fontWeight='500'
            color={selected ? ink.ink : ink.muted}
          >
            {label}
          </UiText>
          <YStack
            height={2}
            marginTop={8}
            marginBottom={-1}
            backgroundColor={selected ? ink.ink : "transparent"}
            borderRadius={1}
          />
        </YStack>
      );
    })}
  </XStack>
);
