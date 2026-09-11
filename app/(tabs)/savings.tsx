// Savings tab — the core product. Vault facts are live (APY from the backend);
// the user's position and deposits arrive with the Turnkey wallet (Stage C /
// Phase 3), so the CTA is present but disabled with an honest footnote.

import React from "react";
import { ScrollView } from "react-native";
import { XStack, YStack } from "tamagui";
import { Landmark, PiggyBank, ShieldCheck, TrendingUp } from "lucide-react-native";

import {
  Card,
  Divider,
  EmptyState,
  IconBox,
  Mono,
  PrimaryButton,
  Screen,
  ScreenTitle,
  Skeleton,
  UiText
} from "@/components/home/primitives";
import { useVaultInfo } from "@/hooks/use-savings";
import { useColors } from "@/lib/theme/appearance";
import { space, tracking } from "@/lib/theme/tokens";
import { fPercent } from "@/lib/utils/number-format.utils";

const HOW_IT_WORKS = [
  {
    Icon: Landmark,
    title: "Deposit USDC",
    body: "Your USDC goes into Normal Savings, a DeFindex vault on Stellar."
  },
  {
    Icon: TrendingUp,
    title: "Earn every day",
    body: "The vault lends through Blend and yield accrues to your position."
  },
  {
    Icon: ShieldCheck,
    title: "Withdraw any time",
    body: "No lock-up. A 0.5% deposit fee and a tiered commission on yield apply."
  }
];

export default function SavingsScreen() {
  const c = useColors();
  const vault = useVaultInfo();

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 96 }}>
        <YStack paddingHorizontal={space.gutter} paddingTop={8} gap={space.section}>
          <ScreenTitle title='Savings' />

          {vault.isError ? (
            <EmptyState
              icon={<PiggyBank size={24} color={c.ink} strokeWidth={1.8} />}
              title='Couldn’t load the vault'
              body={vault.error?.message}
            />
          ) : (
            <Card paddingTop={4} paddingHorizontal={4} paddingBottom={12}>
              <YStack paddingHorizontal={space.rowX} paddingTop={14} paddingBottom={space.rowY} gap={6}>
                <UiText fontSize={14} fontWeight='500' color={c.ink2}>
                  Normal Savings
                </UiText>
                <XStack alignItems='flex-end' gap={8}>
                  {vault.isLoading ? (
                    <Skeleton width={120} height={36} />
                  ) : (
                    <Mono fontSize={32} letterSpacing={tracking(32)}>
                      {fPercent(vault.data?.apy ?? 0, { maximumFractionDigits: 2 })}
                    </Mono>
                  )}
                  <UiText fontSize={13} color={c.muted} paddingBottom={6}>
                    APY · {vault.data?.asset ?? "USDC"}
                  </UiText>
                </XStack>
              </YStack>

              <Divider />
              <XStack
                paddingHorizontal={space.rowX}
                paddingVertical={space.rowY}
                justifyContent='space-between'
                alignItems='center'
              >
                <UiText fontSize={13.5} color={c.muted}>
                  Your position
                </UiText>
                <Mono fontSize={15}>—</Mono>
              </XStack>
              <Divider />
              <XStack
                paddingHorizontal={space.rowX}
                paddingVertical={space.rowY}
                justifyContent='space-between'
                alignItems='center'
              >
                <UiText fontSize={13.5} color={c.muted}>
                  Earned
                </UiText>
                <Mono fontSize={15}>—</Mono>
              </XStack>

              <YStack marginTop={12} marginHorizontal={8} gap={8}>
                <PrimaryButton label='Deposit USDC' disabled />
                <UiText fontSize={11} color={c.faint} textAlign='center' fontFamily='$mono'>
                  Deposits arrive with the Normal wallet
                </UiText>
              </YStack>
            </Card>
          )}

          <YStack gap={12}>
            <UiText fontSize={14} fontWeight='500' color={c.ink2}>
              How it works
            </UiText>
            <Card>
              {HOW_IT_WORKS.map(({ Icon, title, body }, i) => (
                <React.Fragment key={title}>
                  {i > 0 ? <Divider /> : null}
                  <XStack padding={space.rowX} gap={space.rowGap} alignItems='flex-start'>
                    <IconBox size={32}>
                      <Icon size={16} color={c.ink} strokeWidth={1.8} />
                    </IconBox>
                    <YStack flex={1} gap={3}>
                      <UiText fontSize={14} fontWeight='600'>
                        {title}
                      </UiText>
                      <UiText fontSize={13} color={c.muted} lineHeight={18}>
                        {body}
                      </UiText>
                    </YStack>
                  </XStack>
                </React.Fragment>
              ))}
            </Card>
          </YStack>
        </YStack>
      </ScrollView>
    </Screen>
  );
}
