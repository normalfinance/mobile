// Send XLM / USDC on Stellar. Client-side end to end (Q41): the rules in
// lib/stellar/send.ts decide, the Turnkey passkey signs, Horizon receives.
// Flow: form → confirm sheet → device gate (one passkey check the first time)
// → sign → submit → result. Never collect a signature for a transaction that
// must fail: every block (reserve, activation, trustline, memo) fires before
// the passkey prompt.

import React from "react";
import { Alert, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Input, XStack, YStack } from "tamagui";
import { Check, ChevronLeft, ClipboardPaste, ScanLine, TriangleAlert, X } from "lucide-react-native";

import { AssetIcon } from "@/components/ui/AssetIcon";
import { QrScanner } from "@/components/send/QrScanner";
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
import { useBackendPortfolio } from "@/hooks/use-backend-portfolio";
import { useSavingsPosition } from "@/hooks/use-savings";
import { refreshAfterStellarAction } from "@/lib/data/after-action";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";
import { useTurnkeyWallet } from "@/hooks/use-turnkey-wallet";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";
import { describeTurnkeyError } from "@/lib/turnkey/client";
import { ensureDeviceReady } from "@/lib/turnkey/device-check";
import { useDeviceReady } from "@/lib/turnkey/device-ready";
import {
  STELLAR_TX_FEE_XLM,
  fetchMemoRequirement,
  isValidStellarAddress,
  loadSource,
  sendStellar,
  spendableXlmForOutflow,
  type MemoRequirement,
  type SendStep,
  type SendableSymbol
} from "@/lib/stellar/send";
import { parseStellarQr } from "@/lib/stellar/qr";
import { fAssetQuantity, fCurrency, shortenAddress } from "@/lib/utils/number-format.utils";

const STEP_LABEL: Record<SendStep, string> = {
  checking: "Checking balances…",
  building: "Preparing transaction…",
  signing: "Waiting for your passkey…",
  submitting: "Sending to the network…"
};

const SYMBOLS: SendableSymbol[] = ["XLM", "USDC"];

export default function SendScreen() {
  const c = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ symbol?: string }>();
  const { user } = useSupabaseAuth();
  const { wallet } = useTurnkeyWallet();
  const { ready: deviceReady } = useDeviceReady(wallet?.subOrgId);
  const { portfolioData } = useBackendPortfolio();
  // #67: an active savings position holds back 1 XLM from every outflow so
  // future withdrawal fees can always be paid.
  const { hasActiveSavings } = useSavingsPosition(wallet?.stellarAddress);

  const initial = (params.symbol ?? "XLM").toUpperCase();
  const [symbol, setSymbol] = React.useState<SendableSymbol>(initial === "USDC" ? "USDC" : "XLM");
  const [amount, setAmount] = React.useState("");
  const [destination, setDestination] = React.useState("");
  const [memo, setMemo] = React.useState("");
  const [memoReq, setMemoReq] = React.useState<MemoRequirement | null>(null);
  const [spendable, setSpendable] = React.useState<number | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [scanning, setScanning] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [step, setStep] = React.useState<SendStep | null>(null);
  const [result, setResult] = React.useState<{ hash: string } | null>(null);

  const from = wallet?.stellarAddress ?? null;
  const asset = portfolioData.assets.find((a) => a.asset_code === symbol);
  const price = asset?.usdPrice ?? 0;
  const amountNum = Number(amount.replace(",", "."));
  const amountOk = Number.isFinite(amountNum) && amountNum > 0;
  const destTrim = destination.trim().toUpperCase();
  const destOk = isValidStellarAddress(destTrim) && destTrim !== from;
  const memoMissing = !!memoReq?.required && !memo.trim();

  // Live spendable balance from Horizon (reserve-aware), not the cached portfolio.
  React.useEffect(() => {
    let cancelled = false;
    if (!from) return;
    loadSource(from)
      .then((s) => {
        if (cancelled) return;
        setSpendable(
          symbol === "XLM"
            ? spendableXlmForOutflow(s.xlmBalance, s.subentryCount, hasActiveSavings)
            : s.usdcBalance ?? 0
        );
      })
      .catch(() => {
        if (!cancelled) setSpendable(Number(asset?.balance ?? 0));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, symbol, hasActiveSavings]);

  // Memo-required lookup as soon as the address is valid (seed list first, then the route).
  React.useEffect(() => {
    let cancelled = false;
    if (!destOk) {
      setMemoReq(null);
      return;
    }
    fetchMemoRequirement(destTrim).then((r) => {
      if (!cancelled) setMemoReq(r);
    });
    return () => {
      cancelled = true;
    };
  }, [destOk, destTrim]);

  const paste = async () => {
    const text = (await Clipboard.getStringAsync()).trim();
    if (text) setDestination(text);
  };

  /** A scanned code can carry address, memo and (SEP-7) an amount + asset. */
  const applyScan = (data: string): string | void => {
    const parsed = parseStellarQr(data);
    if ("error" in parsed) return parsed.error;
    setDestination(parsed.destination);
    if (parsed.memo !== undefined) setMemo(parsed.memo);
    if (parsed.assetCode === "XLM" || parsed.assetCode === "USDC") setSymbol(parsed.assetCode);
    if (parsed.amount && (!parsed.assetCode || parsed.assetCode === "XLM" || parsed.assetCode === "USDC")) {
      setAmount(parsed.amount);
    }
    setScanning(false);
  };

  const useMax = () => {
    if (spendable !== null) setAmount(spendable.toFixed(7).replace(/\.?0+$/, ""));
  };

  const canContinue = !!from && amountOk && destOk && !memoMissing && (spendable === null || amountNum <= spendable);

  const send = async () => {
    if (!wallet?.subOrgId || !from) return;
    setBusy(true);
    try {
      // Device gate: first send on this phone proves the passkey (or routes to enrolment).
      const gate = await ensureDeviceReady(wallet.subOrgId, from, deviceReady);
      if (gate.outcome === "needs-setup") {
        setConfirming(false);
        router.push("/setup-device");
        return;
      }
      if (gate.outcome === "cancelled") return;
      if (gate.outcome === "failed") {
        Alert.alert("Couldn’t verify this phone", describeTurnkeyError(gate.error));
        return;
      }

      const r = await sendStellar({
        subOrgId: wallet.subOrgId,
        from,
        symbol,
        amount: amountNum,
        destination: destTrim,
        memo: memo.trim() || undefined,
        hasActiveSavings,
        onStep: setStep
      });
      setResult({ hash: r.hash });
      setConfirming(false);
      // Balances and activity changed: bypass the server caches (lib/data/after-action.ts).
      refreshAfterStellarAction(queryClient, { userId: user?.id, stellarAddress: from });
    } catch (e) {
      Alert.alert("Send failed", e instanceof Error ? e.message : describeTurnkeyError(e));
    } finally {
      setStep(null);
      setBusy(false);
    }
  };

  const inputStyle = {
    backgroundColor: c.inputBg,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.input,
    color: c.ink,
    placeholderTextColor: c.faint,
    focusStyle: { borderColor: c.borderStrong }
  } as const;

  if (result) {
    return (
      <Screen>
        <YStack flex={1} paddingHorizontal={space.gutter} paddingTop={80} gap={20}>
          <Card padding={20} gap={12} alignItems='center'>
            <IconBox size={56}>
              <Check size={28} color={c.positive} strokeWidth={2} />
            </IconBox>
            <UiText fontSize={16} fontWeight='500'>
              Sent
            </UiText>
            <Mono fontSize={22} letterSpacing={tracking(22)}>
              {fAssetQuantity(amountNum, symbol)} {symbol}
            </Mono>
            <UiText fontSize={13} color={c.muted} textAlign='center'>
              to {shortenAddress(destTrim, 6, 6)}
            </UiText>
            <Mono fontSize={11} color={c.faint}>
              {shortenAddress(result.hash, 8, 8)}
            </Mono>
            <YStack width='100%' gap={8} marginTop={4}>
              <PrimaryButton label='Done' onPress={() => router.replace("/(tabs)")} />
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
              <IconButton onPress={() => router.back()} label='Back'>
                <ChevronLeft size={22} color={c.ink} strokeWidth={2} />
              </IconButton>
              <UiText fontSize={22} fontWeight='600' letterSpacing={tracking(22)}>
                Send
              </UiText>
            </XStack>

            {/* Asset + amount */}
            <Card padding={14} gap={12}>
              <XStack gap={6}>
                {SYMBOLS.map((s) => {
                  const selected = s === symbol;
                  return (
                    <XStack
                      key={s}
                      onPress={() => {
                        setSymbol(s);
                        setAmount("");
                      }}
                      alignItems='center'
                      gap={8}
                      paddingVertical={6}
                      paddingLeft={6}
                      paddingRight={12}
                      borderRadius={radius.pill}
                      borderWidth={1}
                      borderColor={selected ? c.ink : c.border}
                      backgroundColor={selected ? c.ink : "transparent"}
                    >
                      <AssetIcon symbol={s} size={24} fontSize='$2' />
                      <UiText fontSize={13} fontWeight='600' color={selected ? c.ctaText : c.ink}>
                        {s}
                      </UiText>
                    </XStack>
                  );
                })}
              </XStack>
              <XStack alignItems='center' gap={10}>
                <Input
                  {...inputStyle}
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
                <PillButton label='Max' onPress={useMax} />
              </XStack>
              <XStack justifyContent='space-between'>
                <UiText fontSize={12} color={c.muted}>
                  {amountOk && price ? fCurrency(amountNum * price) : " "}
                </UiText>
                <Mono fontSize={12} color={spendable !== null && amountNum > spendable ? c.failed : c.muted}>
                  {spendable === null ? "…" : `${fAssetQuantity(spendable, symbol)} ${symbol} available`}
                </Mono>
              </XStack>
            </Card>

            {/* Recipient + memo */}
            <Card padding={14} gap={12}>
              <UiText fontSize={12} color={c.muted}>
                To (Stellar address)
              </UiText>
              <XStack alignItems='center' gap={8}>
                <Input
                  {...inputStyle}
                  flex={1}
                  height={48}
                  paddingHorizontal={12}
                  fontFamily='$mono'
                  fontSize={12}
                  placeholder='G…'
                  autoCapitalize='characters'
                  autoCorrect={false}
                  value={destination}
                  onChangeText={setDestination}
                  editable={!busy}
                />
                <IconButton onPress={() => setScanning(true)} label='Scan QR code'>
                  <ScanLine size={20} color={c.muted} strokeWidth={1.8} />
                </IconButton>
                <IconButton onPress={paste} label='Paste'>
                  <ClipboardPaste size={20} color={c.muted} strokeWidth={1.8} />
                </IconButton>
              </XStack>
              {destination.trim() && !destOk ? (
                <UiText fontSize={12} color={c.failed}>
                  {destTrim === from ? "That’s your own address." : "Not a valid Stellar address."}
                </UiText>
              ) : null}

              {memoReq?.required ? (
                <XStack gap={8} padding={12} borderRadius={radius.input} backgroundColor={c.chips.amber.bg}>
                  <TriangleAlert size={16} color={c.chips.amber.color} strokeWidth={2} />
                  <UiText fontSize={13} color={c.chips.amber.color} flex={1} lineHeight={18}>
                    {memoReq.name ?? "This exchange"} requires a deposit memo. Without it your {symbol} will
                    arrive but never be credited to you.
                  </UiText>
                </XStack>
              ) : memoReq?.unknown ? (
                <UiText fontSize={12} color={c.muted}>
                  Couldn’t check whether this address needs a memo. If it’s an exchange, add the memo it gave you.
                </UiText>
              ) : null}

              <UiText fontSize={12} color={c.muted}>
                Memo {memoReq?.required ? "(required)" : "(optional)"}
              </UiText>
              <Input
                {...inputStyle}
                height={44}
                paddingHorizontal={12}
                fontFamily='$mono'
                fontSize={13}
                placeholder='Exchange deposit memo, if any'
                autoCapitalize='none'
                autoCorrect={false}
                maxLength={28}
                value={memo}
                onChangeText={setMemo}
                editable={!busy}
              />
            </Card>

            <XStack justifyContent='space-between' paddingHorizontal={4}>
              <UiText fontSize={13} color={c.muted}>
                Network fee
              </UiText>
              <Mono fontSize={13} color={c.muted}>
                {STELLAR_TX_FEE_XLM} XLM
              </Mono>
            </XStack>

            <PrimaryButton label='Continue' onPress={() => setConfirming(true)} disabled={!canContinue} />
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>

      <QrScanner open={scanning} onClose={() => setScanning(false)} onScan={applyScan} />

      {/* Confirm sheet */}
      <Modal visible={confirming} transparent animationType='slide' onRequestClose={() => !busy && setConfirming(false)}>
        <YStack flex={1} justifyContent='flex-end' backgroundColor='rgba(10,10,15,0.45)'>
          <YStack
            backgroundColor={c.surface}
            borderTopLeftRadius={radius.dialog}
            borderTopRightRadius={radius.dialog}
            padding={space.gutter}
            paddingBottom={32}
            gap={14}
          >
            <XStack justifyContent='space-between' alignItems='center'>
              <UiText fontSize={16} fontWeight='600'>
                Confirm send
              </UiText>
              <IconButton onPress={() => !busy && setConfirming(false)} label='Close'>
                <X size={20} color={c.muted} strokeWidth={2} />
              </IconButton>
            </XStack>
            <YStack alignItems='center' gap={4} paddingVertical={8}>
              <Mono fontSize={32} letterSpacing={tracking(32)}>
                {fAssetQuantity(amountNum, symbol)} {symbol}
              </Mono>
              {price ? (
                <UiText fontSize={13} color={c.muted}>
                  {fCurrency(amountNum * price)}
                </UiText>
              ) : null}
            </YStack>
            <Card paddingTop={4} paddingHorizontal={4} paddingBottom={4}>
              <XStack paddingHorizontal={space.rowX} paddingVertical={space.rowY} justifyContent='space-between'>
                <UiText fontSize={13.5} color={c.muted}>To</UiText>
                <Mono fontSize={12}>{shortenAddress(destTrim, 8, 8)}</Mono>
              </XStack>
              {memo.trim() ? (
                <>
                  <Divider />
                  <XStack paddingHorizontal={space.rowX} paddingVertical={space.rowY} justifyContent='space-between'>
                    <UiText fontSize={13.5} color={c.muted}>Memo</UiText>
                    <Mono fontSize={12}>{memo.trim()}</Mono>
                  </XStack>
                </>
              ) : null}
              <Divider />
              <XStack paddingHorizontal={space.rowX} paddingVertical={space.rowY} justifyContent='space-between'>
                <UiText fontSize={13.5} color={c.muted}>Network fee</UiText>
                <Mono fontSize={12}>{STELLAR_TX_FEE_XLM} XLM</Mono>
              </XStack>
            </Card>
            <UiText fontSize={12} color={c.faint} textAlign='center'>
              Stellar transfers are final and can’t be reversed.
            </UiText>
            <PrimaryButton
              label={step ? STEP_LABEL[step] : "Send with passkey"}
              onPress={send}
              loading={busy}
            />
          </YStack>
        </YStack>
      </Modal>
    </Screen>
  );
}
