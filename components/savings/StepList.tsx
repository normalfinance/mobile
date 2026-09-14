// "What happens when you deposit / withdraw" — the web savings card's step
// list (savings-card.tsx:1148-1260) in the app's own idiom: 18px circles,
// green check when done, ink with a spinner while active, faded dot while
// pending. Always visible so the user knows how many passkey prompts are
// coming BEFORE the first one appears.

import React from "react";
import { ActivityIndicator } from "react-native";
import { XStack, YStack } from "tamagui";
import { Check } from "lucide-react-native";

import { Mono, UiText } from "@/components/home/primitives";
import { useColors } from "@/lib/theme/appearance";

export interface Step {
  id: string;
  label: string;
  sub: string;
}

export const StepList = ({
  title,
  timing,
  steps,
  activeId,
  allDone
}: {
  title: string;
  timing: string;
  steps: Step[];
  /** id of the step in progress; null = idle (nothing highlighted). */
  activeId: string | null;
  allDone?: boolean;
}) => {
  const c = useColors();
  const activeIdx = activeId ? steps.findIndex((s) => s.id === activeId) : -1;
  return (
    <YStack gap={10}>
      <XStack justifyContent='space-between' alignItems='center'>
        <UiText fontSize={11} fontWeight='700' letterSpacing={1.4} color={c.faint}>
          {title.toUpperCase()}
        </UiText>
        <Mono fontSize={10} color={c.faint}>
          {timing}
        </Mono>
      </XStack>
      <YStack>
        {steps.map((step, idx) => {
          const done = allDone || (activeIdx >= 0 && idx < activeIdx);
          const active = !allDone && idx === activeIdx;
          const pending = !done && !active;
          return (
            <XStack key={step.id} alignItems='center' gap={10} paddingVertical={6} opacity={pending ? 0.45 : 1}>
              <YStack
                width={18}
                height={18}
                borderRadius={9}
                alignItems='center'
                justifyContent='center'
                backgroundColor={done ? c.positive : active ? c.cta : c.iconBg}
                borderWidth={pending ? 1 : 0}
                borderColor={c.borderStrong}
                borderStyle='dashed'
              >
                {done ? (
                  <Check size={10} color='#FFFFFF' strokeWidth={3} />
                ) : active ? (
                  <ActivityIndicator size='small' color={c.ctaText} style={{ transform: [{ scale: 0.5 }] }} />
                ) : (
                  <YStack width={5} height={5} borderRadius={3} backgroundColor={c.faint} />
                )}
              </YStack>
              <YStack flex={1}>
                <UiText fontSize={13} fontWeight='500' color={done ? c.positive : active ? c.ink : c.muted}>
                  {step.label}
                  {active ? "…" : ""}
                </UiText>
                <Mono fontSize={11} color={c.faint} marginTop={1}>
                  {step.sub}
                </Mono>
              </YStack>
            </XStack>
          );
        })}
      </YStack>
    </YStack>
  );
};
