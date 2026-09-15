// The autopilot consent moment (web autopilot-consent-dialog.tsx copy):
// offered once before a cross-chain swap starts; "Not now" is remembered.

import React from "react";
import { Modal } from "react-native";
import { XStack, YStack } from "tamagui";
import { Zap } from "lucide-react-native";

import { IconBox, PrimaryButton, SecondaryButton, UiText } from "@/components/home/primitives";
import { useColors } from "@/lib/theme/appearance";
import { radius, space } from "@/lib/theme/tokens";

export const AutopilotSheet = ({ open, busy, onEnable, onNotNow }: { open: boolean; busy: boolean; onEnable: () => void; onNotNow: () => void }) => {
  const c = useColors();
  return (
    <Modal visible={open} transparent animationType='slide' onRequestClose={() => !busy && onNotNow()}>
      <YStack flex={1} justifyContent='flex-end' backgroundColor='rgba(10,10,15,0.45)'>
        <YStack backgroundColor={c.surface} borderTopLeftRadius={radius.dialog} borderTopRightRadius={radius.dialog} padding={space.gutter} paddingBottom={32} gap={14}>
          <XStack alignItems='center' gap={12}>
            <IconBox size={40}><Zap size={20} color={c.ink} strokeWidth={2} /></IconBox>
            <UiText fontSize={16} fontWeight='600' flex={1}>Finish future swaps automatically?</UiText>
          </XStack>
          <UiText fontSize={14} color={c.ink2} lineHeight={20}>
            Cross-chain swaps normally need one more confirmation after the bridge wait. Enable this and Normal finishes that step for you — including a swap that is running right now. You confirm once at the start and walk away.
          </UiText>
          <UiText fontSize={12} color={c.muted} lineHeight={17}>
            Your wallet itself enforces the limits: only swaps you started, only to your own addresses, only the allowlisted bridge contracts. Turn it off anytime in Settings. Enabling takes up to two quick passkey confirmations.
          </UiText>
          <YStack gap={8}>
            <PrimaryButton label={busy ? "Confirming…" : "Enable"} onPress={onEnable} loading={busy} />
            <SecondaryButton label='Not now' onPress={onNotNow} disabled={busy} />
          </YStack>
        </YStack>
      </YStack>
    </Modal>
  );
};
