// Savings tab — the core product. Reads: vault facts (public), the user's
// position (public, slow, cached to disk), and one Horizon probe that drives
// both the guided setup (activate → USDC trustline) and the XLM fee light.
// Deposit / withdraw open app/savings-action.tsx.

import React from "react";
import { Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";
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
  SecondaryButton,
  Skeleton,
  UiText
} from "@/components/home/primitives";
import { ReceiveSheet } from "@/components/home/ReceiveSheet";
import { FeeLight } from "@/components/savings/FeeLight";
import { SetupCard } from "@/components/savings/SetupCard";
import { useSavingsPosition, useStellarAccountProbe, useVaultInfo } from "@/hooks/use-savings";
import { useTurnkeyWallet, walletAddresses } from "@/hooks/use-turnkey-wallet";
import { refreshAfterStellarAction } from "@/lib/data/after-action";
import { addUsdcTrustline, deriveSetupStep } from "@/lib/savings/engine";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";
import { xlmAvailableForFees } from "@/lib/stellar/send";
import { useColors } from "@/lib/theme/appearance";
import { space, tracking } from "@/lib/theme/tokens";
import { describeTurnkeyError } from "@/lib/turnkey/client";
import { ensureDeviceReady } from "@/lib/turnkey/device-check";
import { useDeviceReady } from "@/lib/turnkey/device-ready";
import { fCurrency, fPercent } from "@/lib/utils/number-format.utils";

const HOW_IT_WORKS = [
  { Icon: Landmark, title: "Deposit USDC", body: "Your USDC goes into Normal Savings, a DeFindex vault on Stellar." },
  { Icon: TrendingUp, title: "Earn every day", body: "The vault lends through Blend and yield accrues to your position." },
  { Icon: ShieldCheck, title: "Withdraw any time", body: "No lock-up. A 0.5% deposit fee and a tiered commission on yield apply." }
];

export default function SavingsScreen() {
  const c = useColors();
  const router = useRouter();
  const vault = useVaultInfo();
  const queryClient = useQueryClient();
  const { user } = useSupabaseAuth();
  const { wallet } = useTurnkeyWallet();
  const address = wallet?.stellarAddress ?? null;
  const { ready: deviceReady } = useDeviceReady(wallet?.subOrgId);
  const savings = useSavingsPosition(address);

  // Poll the account while setup is incomplete or the fee light isn't green,
  // so activation / top-ups are noticed without a manual refresh.
  const isFocused = useIsFocused(); // the tab stays mounted; never poll from behind another tab
  const [watch, setWatch] = React.useState(true);
  const probe = useStellarAccountProbe(address, watch && isFocused);
  const step = deriveSetupStep(probe.data ?? null);
  React.useEffect(() => {
    setWatch(!probe.data || step !== "ready" || probe.data.feeStatus !== "ok");
  }, [probe.data, step]);

  const [receiveOpen, setReceiveOpen] = React.useState(false);
  const [addingTrustline, setAddingTrustline] = React.useState(false);

  const handleAddTrustline = async () => {
    if (!wallet?.subOrgId || !address) return;
    setAddingTrustline(true);
    try {
      const gate = await ensureDeviceReady(wallet.subOrgId, address, deviceReady);
      if (gate.outcome === "needs-setup") {
        router.push("/setup-device");
        return;
      }
      if (gate.outcome === "cancelled") return;
      if (gate.outcome === "failed") {
        Alert.alert("Couldn’t verify this phone", describeTurnkeyError(gate.error));
        return;
      }
      await addUsdcTrustline({ subOrgId: wallet.subOrgId, address });
      await probe.refetch();
      refreshAfterStellarAction(queryClient, { userId: user?.id, stellarAddress: address });
    } catch (e) {
      Alert.alert("Couldn’t add the trustline", e instanceof Error ? e.message : describeTurnkeyError(e));
    } finally {
      setAddingTrustline(false);
    }
  };

  const apy = vault.data?.apy ?? null;
  const estMonthly = apy !== null ? (savings.value * (apy / 100)) / 12 : null;
  const blocked = probe.data?.feeStatus === "blocked";
  // Loading or failed with nothing cached → skeleton, never a confident $0.
  const positionPending = !!address && !savings.position;

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
                  Your savings
                </UiText>
                {positionPending ? (
                  <Skeleton width={140} height={36} />
                ) : (
                  <Mono fontSize={32} letterSpacing={tracking(32)}>
                    {fCurrency(savings.value)}
                  </Mono>
                )}
                <UiText fontSize={12} color={c.muted}>
                  {savings.isError ? "Unavailable — retrying…" : "USDC in Normal Savings"}
                </UiText>
              </YStack>

              <Divider />
              <XStack paddingHorizontal={space.rowX} paddingVertical={space.rowY} justifyContent='space-between' alignItems='center'>
                <UiText fontSize={13.5} color={c.muted}>Earned</UiText>
                {positionPending ? (
                  <Skeleton width={70} height={18} />
                ) : (
                  <Mono fontSize={15} color={savings.earnings > 0 ? c.positive : c.ink}>
                    {savings.earnings > 0 ? "+" : ""}
                    {fCurrency(savings.earnings)}
                  </Mono>
                )}
              </XStack>
              <Divider />
              <XStack paddingHorizontal={space.rowX} paddingVertical={space.rowY} justifyContent='space-between' alignItems='center'>
                <UiText fontSize={13.5} color={c.muted}>Current APY</UiText>
                {vault.isLoading ? (
                  <Skeleton width={60} height={18} />
                ) : (
                  <Mono fontSize={15}>{fPercent(apy ?? 0, { maximumFractionDigits: 2 })}</Mono>
                )}
              </XStack>
              <Divider />
              <XStack paddingHorizontal={space.rowX} paddingVertical={space.rowY} justifyContent='space-between' alignItems='center'>
                <UiText fontSize={13.5} color={c.muted}>Est. monthly</UiText>
                <Mono fontSize={15}>{estMonthly === null ? "—" : fCurrency(estMonthly)}</Mono>
              </XStack>

              {step === "ready" && probe.data ? (
                <YStack marginTop={12} marginHorizontal={8} gap={10}>
                  <FeeLight status={probe.data.feeStatus ?? "ok"} available={xlmAvailableForFees(probe.data.xlmBalance, probe.data.subentryCount)} />
                  <PrimaryButton
                    label='Deposit USDC'
                    disabled={blocked}
                    onPress={() => router.push("/savings-action?mode=deposit")}
                  />
                  <SecondaryButton
                    label='Withdraw'
                    disabled={blocked || savings.value <= 0}
                    onPress={() => router.push("/savings-action?mode=withdraw")}
                  />
                </YStack>
              ) : null}
            </Card>
          )}

          {address && step && step !== "ready" ? (
            <SetupCard
              step={step}
              probe={probe.data ?? null}
              onReceiveXlm={() => setReceiveOpen(true)}
              onAddTrustline={handleAddTrustline}
              addingTrustline={addingTrustline}
              checking={probe.isFetching}
            />
          ) : null}

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
                      <UiText fontSize={14} fontWeight='600'>{title}</UiText>
                      <UiText fontSize={13} color={c.muted} lineHeight={18}>{body}</UiText>
                    </YStack>
                  </XStack>
                </React.Fragment>
              ))}
            </Card>
          </YStack>
        </YStack>
      </ScrollView>

      <ReceiveSheet
        open={receiveOpen}
        addresses={walletAddresses(wallet)}
        initialChain='stellar'
        onClose={() => setReceiveOpen(false)}
      />
    </Screen>
  );
}
