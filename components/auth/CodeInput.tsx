// Six digit cells over one invisible input, so the OS one-time-code autofill
// and the number pad both work; fires `onComplete` when the sixth digit lands.

import React from "react";
import { TextInput } from "react-native";
import { XStack, YStack } from "tamagui";

import { Mono } from "@/components/home/primitives";
import { useColors } from "@/lib/theme/appearance";
import { radius, tracking } from "@/lib/theme/tokens";

export const CodeInput = ({ value, onChange, onComplete, disabled }: { value: string; onChange: (v: string) => void; onComplete?: (code: string) => void; disabled?: boolean }) => {
  const c = useColors();
  const ref = React.useRef<TextInput>(null);
  const [focused, setFocused] = React.useState(false);
  const digits = value.replace(/\D/g, "").slice(0, 6);

  const change = (v: string) => {
    const next = v.replace(/\D/g, "").slice(0, 6);
    onChange(next);
    if (next.length === 6) onComplete?.(next);
  };

  return (
    <YStack onPress={() => ref.current?.focus()}>
      <XStack gap={8} justifyContent='space-between'>
        {Array.from({ length: 6 }).map((_, i) => {
          const active = focused && i === Math.min(digits.length, 5);
          return (
            <YStack
              key={i}
              flex={1}
              height={56}
              borderRadius={radius.input}
              borderWidth={active ? 2 : 1}
              borderColor={active ? c.ink : c.border}
              backgroundColor={c.inputBg}
              alignItems='center'
              justifyContent='center'
            >
              <Mono fontSize={24} letterSpacing={tracking(24)}>
                {digits[i] ?? ""}
              </Mono>
            </YStack>
          );
        })}
      </XStack>
      <TextInput
        ref={ref}
        value={digits}
        onChangeText={change}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType='number-pad'
        textContentType='oneTimeCode'
        autoComplete='one-time-code'
        maxLength={6}
        editable={!disabled}
        autoFocus
        caretHidden
        style={{ position: "absolute", opacity: 0, height: 56, width: "100%" }}
      />
    </YStack>
  );
};
