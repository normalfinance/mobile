// Drawer tabs (connected-wallet.tsx:276-300): 13.5/500 muted, selected ink,
// 2px ink indicator, 1px bottom border, no uppercase. Generic over the tab keys
// so the same control serves Home (Tokens / Activity) and the asset detail.

import React from "react";
import { XStack, YStack } from "tamagui";

import { useColors } from "@/lib/theme/appearance";
import { typeScale as t } from "@/lib/theme/tokens";
import { UiText } from "./primitives";

export type HomeTab = "tokens" | "activity";

export const SegmentTabs = <K extends string>({
  value,
  onChange,
  tabs
}: {
  value: K;
  onChange: (tab: K) => void;
  tabs: { key: K; label: string }[];
}) => {
  const c = useColors();
  return (
    <XStack borderBottomWidth={1} borderBottomColor={c.border} gap={4}>
      {tabs.map(({ key, label }) => {
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
            accessibilityRole='tab'
            accessibilityState={{ selected }}
          >
            <UiText
              fontSize={t.tab.size}
              fontWeight='500'
              color={selected ? c.ink : c.muted}
            >
              {label}
            </UiText>
            <YStack
              height={2}
              marginTop={8}
              marginBottom={-1}
              backgroundColor={selected ? c.ink : "transparent"}
              borderRadius={1}
            />
          </YStack>
        );
      })}
    </XStack>
  );
};

const HOME_TABS: { key: HomeTab; label: string }[] = [
  { key: "tokens", label: "Tokens" },
  { key: "activity", label: "Activity" }
];

export const HomeTabs = ({
  value,
  onChange
}: {
  value: HomeTab;
  onChange: (tab: HomeTab) => void;
}) => <SegmentTabs value={value} onChange={onChange} tabs={HOME_TABS} />;
