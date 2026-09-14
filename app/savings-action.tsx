// Deposit into / withdraw from Normal Savings. The step list is visible from
// the start (the user sees "2 passkey prompts" before the first one), lights
// up step by step while the engine runs, and every block (balance, XLM fee
// floor, trustline) fires before any signature is requested.

import React from "react";
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Input, XStack, YStack } from "tamagui";
import { Check, ChevronLeft } from "lucide-react-native";

import {
  Card,
  Divider,
  IconBox,
  IconButton,
  Mono,
  PillButton,
  PrimaryButton,
  Screen,
  SecondaryButton,
  UiText
} from "@/components/home/primitives";
import { StepList, type Step } from "@/components/savings/StepList";
import { useSavingsPosition, useStellarAccountProbe, useVaultInfo } from "@/hooks/use-savings";
import { useTurnkeyWallet } from "@/hooks/use-turnkey-wallet";
import {
  depositToSavings,
  positionAfterDeposit,
  positionAfterWithdraw,
  withdrawFromSavings,
  type DepositStep,
  type WithdrawStep
} from "@/lib/savings/engine";
import { getSavingsDepositFee, getYieldCommission, getYieldCommissionRate } from "@/lib/savings/normal-fees";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";
import { describeTurnkeyError, isUserCancelledError } from "@/lib/turnkey/client";
import { ensureDeviceReady } from "@/lib/turnkey/device-check";
import { useDeviceReady } from "@/lib/turnkey/device-ready";
import { fCurrency, shortenAddress } from "@/lib/utils/number-format.utils";

type Mode = "deposit" | "withdraw";

const truncate7 = (v: number) => (Math.floor(v * 1e7) / 1e7).toFixed(7).replace(/\.?0+$/, "");

export default function SavingsActionScreen() {
  const c = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode: Mode = params.mode === "withdraw" ? "withdraw" : "deposit";

  const vault = useVaultInfo();
  const { wallet } = useTurnkeyWallet();
  const address = wallet?.stellarAddress ?? null;
  const { ready: deviceReady } = useDeviceReady(wallet?.subOrgId);
  const savings = useSavingsPosition(address);
  const probe = useStellarAccountProbe(address, false);

  const [amount, setAmount] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [step, setStepState] = React.useState<DepositStep | WithdrawStep | null>(null);
  // A haptic tick as each step starts — the user feels progress between prompts.
  const setStep = (next: DepositStep | WithdrawStep | null) => {
    setStepState(next);
    if (next) void Haptics.selectionAsync().catch(() => undefined);
  };
  const [result, setResult] = React.useState<{ hash: string; feeSubmitted: boolean; net: number } | null>(null);

  const apy = vault.data?.apy ?? 0;
  const amountNum = Number(amount.replace(",", "."));
  const amountOk = Number.isFinite(amountNum) && amountNum > 0;
  const available = mode === "deposit" ? probe.data?.usdcBalance ?? 0 : savings.value;
  const over = amountOk && amountNum > available + 1e-7;

  const depositFee = mode === "deposit" && amountOk ? getSavingsDepositFee(amountNum) : 0;
  const netDeposit = Math.max(amountNum - depositFee, 0);
  const commission =
    mode === "withdraw" && amountOk
      ? getYieldCommission({ withdrawAmount: amountNum, currentValue: savings.value, earnings: savings.earnings })
      : 0;
  const commissionPct = Math.round(getYieldCommissionRate(amountNum) * 100);
  const hasCommission = amountOk ? commission > 0 : savings.earnings > 0;

  const depositSteps: Step[] = [
    { id: "checking", label: "Checking balance", sub: "Verifying USDC on Stellar" },
    { id: "deposit_sign", label: "Signing deposit", sub: "Confirm with passkey · 1 of 2" },
    { id: "fee_sign", label: "Signing fee payment", sub: "Confirm with passkey · 2 of 2" },
    { id: "deposit_broadcast", label: "Crediting savings vault", sub: `Blend USDC pool · ${apy}% APY` }
  ];
  const withdrawSteps: Step[] = hasCommission
    ? [
        { id: "withdraw_sign", label: "Signing withdrawal", sub: "Confirm with passkey · 1 of 2" },
        { id: "commission_sign", label: "Signing yield commission", sub: "Confirm with passkey · 2 of 2" },
        { id: "withdraw_broadcast", label: "Processing withdrawal", sub: "horizon.stellar.org" }
      ]
    : [
        { id: "withdraw_sign", label: "Signing withdrawal", sub: "Confirm with passkey" },
        { id: "withdraw_broadcast", label: "Broadcasting to Stellar", sub: "horizon.stellar.org" }
      ];
  const steps = mode === "deposit" ? depositSteps : withdrawSteps;
  const timing = mode === "deposit" ? "~30s" : hasCommission ? "~20s" : "~10s";

  const canRun = !!address && amountOk && !over && !busy && !!vault.data?.address;

  const run = async () => {
    if (!wallet?.subOrgId || !address || !vault.data?.address) return;
    setBusy(true);
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
      // Snapshot BEFORE anything moves — the optimistic update is computed from
      // this fixed point, never from a value a background refresh may have bumped.
      const before = savings.position;
      if (mode === "deposit") {
        const r = await depositToSavings({
          subOrgId: wallet.subOrgId,
          address,
          vaultAddress: vault.data.address,
          amount: amountNum,
          onStep: setStep
        });
        savings.settle(positionAfterDeposit(before, r.netAmount));
        setResult({ hash: r.serviceHash, feeSubmitted: r.feeSubmitted, net: r.netAmount });
      } else {
        const r = await withdrawFromSavings({
          subOrgId: wallet.subOrgId,
          address,
          vaultAddress: vault.data.address,
          amount: amountNum,
          position: before,
          onStep: setStep
        });
        savings.settle(positionAfterWithdraw(before, amountNum));
        setResult({ hash: r.serviceHash, feeSubmitted: r.feeSubmitted || r.commissionAmount === 0, net: amountNum });
      }
      // Wallet USDC / XLM moved too.
      void queryClient.invalidateQueries({ queryKey: ["backend-portfolio"] });
      void queryClient.invalidateQueries({ queryKey: ["stellar", "account-probe"] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
    } catch (e) {
      if (isUserCancelledError(e)) {
        // Literally true with sign-both-first: no signature → nothing submitted.
        Alert.alert("Cancelled", "Nothing was submitted and nothing was charged.");
      } else {
        Alert.alert(mode === "deposit" ? "Deposit failed" : "Withdrawal failed", e instanceof Error ? e.message : describeTurnkeyError(e));
      }
    } finally {
      setStep(null);
      setBusy(false);
    }
  };

  if (result) {
    return (
      <Screen>
        <YStack flex={1} paddingHorizontal={space.gutter} paddingTop={80} gap={20}>
          <Card padding={20} gap={12} alignItems='center'>
            <IconBox size={56}>
              <Check size={28} color={c.positive} strokeWidth={2} />
            </IconBox>
            <UiText fontSize={16} fontWeight='500'>
              {mode === "deposit" ? "Deposited" : "Withdrawn"}
            </UiText>
            <Mono fontSize={22} letterSpacing={tracking(22)}>
              {fCurrency(result.net)}
            </Mono>
            <StepList title={mode === "deposit" ? "Deposit complete" : "Withdrawal complete"} timing='' steps={steps} activeId={null} allDone />
            {!result.feeSubmitted ? (
              <UiText fontSize={12} color={c.muted} textAlign='center' lineHeight={17}>
                The Normal fee settles as a separate small USDC transaction in the next few minutes.
              </UiText>
            ) : null}
            <Mono fontSize={11} color={c.faint}>
              {shortenAddress(result.hash, 8, 8)}
            </Mono>
            <YStack width='100%' gap={8} marginTop={4}>
              <PrimaryButton label='Done' onPress={() => router.back()} />
              <SecondaryButton
                label='View on stellar.expert'
                onPress={() => Linking.openURL(`https://stellar.expert/explorer/public/tx/${result.hash}`)}
              />
            </YStack>
          </Card>
        </YStack>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps='handled'>
          <YStack paddingHorizontal={space.gutter} paddingTop={56} gap={20}>
            <XStack alignItems='center' gap={4}>
              <IconButton onPress={() => !busy && router.back()} label='Back'>
                <ChevronLeft size={22} color={c.ink} strokeWidth={2} />
              </IconButton>
              <UiText fontSize={22} fontWeight='600' letterSpacing={tracking(22)}>
                {mode === "deposit" ? "Deposit USDC" : "Withdraw USDC"}
              </UiText>
            </XStack>

            <Card padding={14} gap={12}>
              <XStack alignItems='center' gap={10}>
                <Input
                  backgroundColor={c.inputBg}
                  borderWidth={1}
                  borderColor={c.border}
                  borderRadius={radius.input}
                  color={c.ink}
                  placeholderTextColor={c.faint}
                  focusStyle={{ borderColor: c.borderStrong }}
                  flex={1}
                  height={56}
                  fontFamily='$mono'
                  fontSize={28}
                  letterSpacing={tracking(28)}
                  placeholder='0.00'
                  keyboardType='decimal-pad'
                  value={amount}
                  onChangeText={setAmount}
                  editable={!busy}
                />
                <PillButton label='Max' onPress={() => setAmount(truncate7(available))} />
              </XStack>
              <XStack justifyContent='space-between'>
                <UiText fontSize={12} color={c.muted}>
                  {mode === "deposit" && amountOk ? `Est. yearly earnings ${fCurrency((amountNum * apy) / 100)}` : " "}
                </UiText>
                <Mono fontSize={12} color={over ? c.failed : c.muted}>
                  {mode === "deposit"
                    ? probe.data
                      ? `${available.toFixed(2)} USDC in wallet`
                      : "…"
                    : `${available.toFixed(2)} USDC saved`}
                </Mono>
              </XStack>
            </Card>

            {amountOk && (mode === "deposit" || commission > 0) ? (
              <Card paddingTop={4} paddingHorizontal={4} paddingBottom={4}>
                {mode === "deposit" ? (
                  <>
                    <XStack paddingHorizontal={space.rowX} paddingVertical={space.rowY} justifyContent='space-between'>
                      <UiText fontSize={13.5} color={c.muted}>Normal fee (0.5%)</UiText>
                      <Mono fontSize={13}>-{depositFee.toFixed(2)} USDC</Mono>
                    </XStack>
                    <Divider />
                    <XStack paddingHorizontal={space.rowX} paddingVertical={space.rowY} justifyContent='space-between'>
                      <UiText fontSize={13.5} color={c.muted}>Goes into savings</UiText>
                      <Mono fontSize={13}>{netDeposit.toFixed(2)} USDC</Mono>
                    </XStack>
                  </>
                ) : (
                  <XStack paddingHorizontal={space.rowX} paddingVertical={space.rowY} justifyContent='space-between'>
                    <UiText fontSize={13.5} color={c.muted}>Normal {commissionPct}% yield commission</UiText>
                    <Mono fontSize={13}>-{commission.toFixed(2)} USDC</Mono>
                  </XStack>
                )}
              </Card>
            ) : null}

            <Card padding={14} gap={12}>
              <StepList
                title={mode === "deposit" ? "What happens when you deposit" : "What happens when you withdraw"}
                timing={timing}
                steps={steps}
                activeId={step}
              />
              {mode === "deposit" || hasCommission ? (
                <UiText fontSize={12} color={c.muted} lineHeight={17}>
                  {mode === "deposit"
                    ? "You’ll confirm twice with your passkey: once for the deposit itself, once for the 0.5% Normal fee, which is a separate Stellar payment. Nothing is sent until both are confirmed."
                    : "You’ll confirm twice with your passkey: once for the withdrawal, once for the yield commission, which is a separate Stellar payment. Nothing is sent until both are confirmed."}
                </UiText>
              ) : null}
            </Card>

            <PrimaryButton
              label={
                busy
                  ? (steps.find((s) => s.id === step)?.label ?? "Working") + "…"
                  : mode === "deposit"
                    ? "Deposit with passkey"
                    : "Withdraw with passkey"
              }
              onPress={run}
              disabled={!canRun}
              loading={busy}
            />
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
