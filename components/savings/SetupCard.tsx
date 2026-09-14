// Guided savings setup (web savings-setup-dialog.tsx): what a user must do
// before they can save — (1) activate the Stellar account with XLM, (2) add
// the USDC trustline. The current step is DERIVED from chain state, never
// remembered (web normal-wallet-setup deriveSetupStep), so a killed app
// resumes at the first unmet condition. Activation is detected by the probe
// polling while the card is visible — the step advances on its own.

import React from "react";
import { ActivityIndicator } from "react-native";
import { XStack, YStack } from "tamagui";
import { Check } from "lucide-react-native";

import { Card, IconBox, Mono, PrimaryButton, SecondaryButton, UiText } from "@/components/home/primitives";
import type { SetupStep, StellarAccountProbe } from "@/lib/savings/engine";
import { MIN_XLM_FOR_SOROBAN_TX } from "@/lib/stellar/send";
import { useColors } from "@/lib/theme/appearance";
import { radius, space } from "@/lib/theme/tokens";

const STEPS: { key: Exclude<SetupStep, "ready">; label: string }[] = [
  { key: "activate", label: "Activate" },
  { key: "trustline", label: "Add USDC" }
];

export const SetupCard = ({
  step,
  probe,
  onReceiveXlm,
  onAddTrustline,
  addingTrustline,
  checking
}: {
  step: SetupStep;
  probe: StellarAccountProbe | null;
  onReceiveXlm: () => void;
  onAddTrustline: () => void;
  addingTrustline: boolean;
  checking: boolean;
}) => {
  const c = useColors();
  const activeIdx = step === "activate" ? 0 : 1;
  // An activated account that ran out of fee XLM comes back here (#67).
  const topUp = step === "activate" && !!probe?.exists;

  return (
    <Card padding={space.cardInner} gap={16}>
      <YStack gap={2}>
        <UiText fontSize={16} fontWeight='600'>
          {topUp ? "Top up XLM for fees" : "Set up Normal Savings"}
        </UiText>
        <UiText fontSize={13} color={c.muted}>
          {topUp ? "Savings actions pay a small network fee in XLM." : "A couple of quick steps to start earning yield on USDC."}
        </UiText>
      </YStack>

      <XStack gap={8}>
        {STEPS.map((s, i) => {
          const done = i < activeIdx || step === "ready";
          const active = i === activeIdx && step !== "ready";
          return (
            <XStack key={s.key} flex={1} alignItems='center' gap={6}>
              <YStack
                width={20}
                height={20}
                borderRadius={10}
                alignItems='center'
                justifyContent='center'
                backgroundColor={done ? c.chips.green.bg : active ? c.cta : c.iconBg}
              >
                {done ? (
                  <Check size={12} color={c.chips.green.color} strokeWidth={3} />
                ) : (
                  <UiText fontSize={11} fontWeight='700' color={active ? c.ctaText : c.faint}>
                    {i + 1}
                  </UiText>
                )}
              </YStack>
              <UiText fontSize={12} fontWeight={active ? "600" : "500"} color={active || done ? c.ink : c.faint}>
                {s.label}
              </UiText>
            </XStack>
          );
        })}
      </XStack>

      {step === "activate" ? (
        <YStack gap={12}>
          <YStack padding={12} borderRadius={radius.input} backgroundColor={c.chips.blue.bg}>
            <UiText fontSize={13} color={c.ink2} lineHeight={19}>
              {topUp
                ? `Only ${(probe?.xlmBalance ?? 0).toFixed(2)} XLM is on the account and most of it is locked as reserve. Receive at least ${MIN_XLM_FOR_SOROBAN_TX} XLM more — it's detected automatically.`
                : "Your Stellar account needs a little XLM before it can hold USDC. Receive about 3 XLM to your Stellar address: 1 activates it, 0.5 is reserved for the USDC trustline, and the rest pays network fees. It activates automatically the moment funds arrive."}
            </UiText>
          </YStack>
          <PrimaryButton label='Show my XLM address' onPress={onReceiveXlm} />
          <XStack alignItems='center' justifyContent='center' gap={8}>
            <ActivityIndicator size='small' color={c.faint} />
            <Mono fontSize={11} color={c.faint}>
              {checking ? "Checking…" : "Watching for your XLM — activates automatically"}
            </Mono>
          </XStack>
        </YStack>
      ) : step === "trustline" ? (
        <YStack gap={12}>
          <YStack padding={12} borderRadius={radius.input} backgroundColor={c.chips.blue.bg}>
            <UiText fontSize={13} color={c.ink2} lineHeight={19}>
              Nice — your account is active. Add a USDC trustline so it can hold and earn USDC. One passkey confirmation, a tiny network fee.
            </UiText>
          </YStack>
          <PrimaryButton
            label={addingTrustline ? "Adding trustline…" : "Add USDC trustline"}
            onPress={onAddTrustline}
            loading={addingTrustline}
          />
        </YStack>
      ) : (
        <YStack alignItems='center' gap={10}>
          <IconBox size={48}>
            <Check size={24} color={c.positive} strokeWidth={2.5} />
          </IconBox>
          <UiText fontSize={14} color={c.muted} textAlign='center'>
            You’re all set — deposit USDC to start earning.
          </UiText>
        </YStack>
      )}
      {step === "trustline" ? <SecondaryButton label='Show my XLM address' onPress={onReceiveXlm} /> : null}
    </Card>
  );
};
