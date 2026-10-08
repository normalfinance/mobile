// Cash out USDC at a MoneyGram location (SEP-24 withdraw). Web's offramp
// dialog opens MoneyGram and then relies on the user to send the USDC by
// hand ("MoneyGram ready — send USDC when prompted"). Here the flow is
// finished in-app: amount within MoneyGram's live limits → SEP-10 sign-in
// (one passkey, cached) → MoneyGram's page in the in-app browser (pick the
// location) → the app polls until MoneyGram reports
// pending_user_transfer_start with withdraw_anchor_account + memo → one
// passkey sends exactly that USDC with the memo → the app watches for
// completion (cash ready for pickup). Resumable from the Activity row.

import React from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Input, XStack, YStack } from "tamagui";
import { Banknote, ChevronLeft } from "lucide-react-native";

import { Card, Chip, Divider, IconButton, Mono, PillButton, PrimaryButton, Screen, SecondaryButton, UiText } from "@/components/home/primitives";
import { useBackendPortfolio } from "@/hooks/use-backend-portfolio";
import { useMgiLimits, mgiTransactionsQueryKey } from "@/hooks/use-mgi";
import { useSavingsPosition, useStellarAccountProbe } from "@/hooks/use-savings";
import { useTurnkeyWallet } from "@/hooks/use-turnkey-wallet";
import { refreshAfterStellarAction } from "@/lib/data/after-action";
import {
  FAILED_MGI_STATUSES,
  TERMINAL_MGI_STATUSES,
  getMgiAuthToken,
  getMgiTransaction,
  hasCachedMgiToken,
  mgiStatusLabel,
  openMgiDetails,
  refreshMgiStatus,
  reportMgiStatus,
  startMgiWithdraw,
  watchMgiCommit,
  type Sep24Transaction
} from "@/lib/ramp/moneygram";
import { addPendingSend } from "@/lib/send/pending-sends";
import { sendStellar } from "@/lib/stellar/send";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";
import { describeTurnkeyError, isUserCancelledError } from "@/lib/turnkey/client";
import { ensureDeviceReady } from "@/lib/turnkey/device-check";
import { useDeviceReady } from "@/lib/turnkey/device-ready";
import { fCurrency, fNumber } from "@/lib/utils/number-format.utils";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

const PRESETS = [20, 50, 100, 250];
const shorten = (s: string) => (s.length > 16 ? `${s.slice(0, 6)}…${s.slice(-6)}` : s);

interface Committed {
  id: string;
  status: string;
  amount: number;
  anchorAccount: string | null;
  memo: string | null;
  memoType: string | null;
  reference: string | null;
  /** Our USDC payment hash, once sent. */
  txHash: string | null;
}

export default function CashOutScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ resume?: string }>();
  const { user } = useSupabaseAuth();
  const { wallet } = useTurnkeyWallet();
  const address = wallet?.stellarAddress ?? null;
  const { ready: deviceReady } = useDeviceReady(wallet?.subOrgId);
  const { portfolioData } = useBackendPortfolio();
  const { hasActiveSavings } = useSavingsPosition(address);
  const limits = useMgiLimits().withdraw;
  const probe = useStellarAccountProbe(address, false);
  const usdcBalance = probe.data?.usdcBalance ?? Number(portfolioData.assets.find((a) => a.asset_code === "USDC")?.balance ?? 0);

  const [amount, setAmount] = React.useState(String(PRESETS[1]));
  const [busy, setBusy] = React.useState<null | "signin" | "open" | "sending" | "resuming">(params.resume ? "resuming" : null);
  const [committed, setCommitted] = React.useState<Committed | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const amountNum = Number(amount.replace(",", "."));
  const amountOk = Number.isFinite(amountNum) && amountNum >= limits.min && amountNum <= limits.max;
  const insufficient = amountOk && amountNum > usdcBalance + 1e-7;
  const presets = PRESETS.filter((p) => p >= limits.min && p <= limits.max);

  const applyTx = (id: string, tx: Sep24Transaction, amt?: number) =>
    setCommitted((prev) => ({
      id,
      status: tx.status,
      amount: amt ?? prev?.amount ?? Number(tx.amount_in?.amount ?? 0),
      anchorAccount: tx.withdraw_anchor_account ?? prev?.anchorAccount ?? null,
      memo: tx.withdraw_memo ?? prev?.memo ?? null,
      memoType: tx.withdraw_memo_type ?? prev?.memoType ?? null,
      reference: tx.external_transaction_id ? String(tx.external_transaction_id) : prev?.reference ?? null,
      txHash: tx.stellar_transaction_id ?? prev?.txHash ?? null
    }));

  const gate = async (): Promise<boolean> => {
    if (!wallet?.subOrgId || !address) return false;
    const g = await ensureDeviceReady(wallet.subOrgId, address, deviceReady);
    if (g.outcome === "needs-setup") {
      router.push("/setup-device");
      return false;
    }
    if (g.outcome === "cancelled") return false;
    if (g.outcome === "failed") {
      Alert.alert("Couldn’t verify this phone", describeTurnkeyError(g.error));
      return false;
    }
    return true;
  };

  // Resume from an Activity row: read the live transaction (one passkey if
  // the SEP-10 token expired) and land on the "send the USDC" step.
  React.useEffect(() => {
    const id = params.resume;
    if (!id || !address || !wallet?.subOrgId) return;
    let cancelled = false;
    (async () => {
      try {
        const tx = await refreshMgiStatus(address, wallet.subOrgId, id);
        if (!cancelled) applyTx(id, tx);
      } catch (e) {
        if (!cancelled && !isUserCancelledError(e)) Alert.alert("Couldn’t load the cash-out", e instanceof Error ? e.message : describeTurnkeyError(e));
      } finally {
        if (!cancelled) setBusy(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.resume, address, wallet?.subOrgId]);

  const start = async () => {
    if (!wallet?.subOrgId || !address || !amountOk || insufficient) return;
    try {
      if (!(await gate())) return;
      setBusy("signin");
      const token = await getMgiAuthToken(address, wallet.subOrgId);
      setBusy("open");
      const { url, id } = await startMgiWithdraw(token, address, amountNum);
      void queryClient.invalidateQueries({ queryKey: mgiTransactionsQueryKey(user?.id) });
      let closed = false;
      const watcher = id ? watchMgiCommit(address, id, token, { until: () => closed, onStatus: (tx) => tx.status !== "incomplete" && applyTx(id, tx, amountNum) }) : Promise.resolve(null);
      await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN });
      closed = true;
      let result = await watcher;
      if (!result && id) {
        try {
          const tx = await getMgiTransaction(address, id, token);
          if (tx.status !== "incomplete") result = tx;
        } catch {
          /* leave as not committed */
        }
      }
      if (result && id) applyTx(id, result, amountNum);
      else if (!id) Alert.alert("MoneyGram opened", "If you confirmed a cash-out, it will appear in Activity once MoneyGram reports it.");
      else Alert.alert("Nothing started", "You closed MoneyGram before confirming a cash-out. Nothing was sent — start again whenever you’re ready.");
      void queryClient.invalidateQueries({ queryKey: mgiTransactionsQueryKey(user?.id) });
    } catch (e) {
      if (!isUserCancelledError(e)) Alert.alert("Couldn’t start the cash-out", e instanceof Error ? e.message : describeTurnkeyError(e));
    } finally {
      setBusy(null);
    }
  };

  // The payment MoneyGram asked for: exactly amount_in to the anchor account
  // with its memo (memo-less sends to an anchor are lost — hard rule 12).
  const sendUsdc = async () => {
    if (!committed?.anchorAccount || !wallet?.subOrgId || !address) return;
    if (committed.memoType === "hash") {
      Alert.alert("Unsupported memo", "MoneyGram asked for a hash memo, which this app can’t attach yet. Open MoneyGram details and send from another wallet, or contact support.");
      return;
    }
    if (!committed.memo) {
      Alert.alert("No memo from MoneyGram", "MoneyGram did not provide a payment memo. Refresh the status, and if it stays empty contact support rather than sending without one.");
      return;
    }
    setBusy("sending");
    try {
      if (!(await gate())) return;
      const r = await sendStellar({ subOrgId: wallet.subOrgId, from: address, symbol: "USDC", amount: committed.amount, destination: committed.anchorAccount, memo: committed.memo, hasActiveSavings });
      addPendingSend({ chain: "stellar", txHash: r.hash, symbol: "USDC", amount: String(committed.amount), destination: committed.anchorAccount });
      setCommitted((prev) => (prev ? { ...prev, txHash: r.hash, status: "pending_anchor" } : prev));
      await reportMgiStatus(committed.id, { status: "pending_anchor" });
      refreshAfterStellarAction(queryClient, { userId: user?.id, stellarAddress: address });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
    } catch (e) {
      if (!isUserCancelledError(e)) Alert.alert("Couldn’t send the USDC", e instanceof Error ? e.message : describeTurnkeyError(e));
    } finally {
      setBusy(null);
    }
  };

  // Watch the cash-out every 15 s while open and not terminal — cached token only.
  React.useEffect(() => {
    if (!committed || !address || !wallet?.subOrgId || TERMINAL_MGI_STATUSES.has(committed.status) || !isFocused) return;
    const id = committed.id;
    const iv = setInterval(async () => {
      if (!(await hasCachedMgiToken(address))) return;
      try {
        applyTx(id, await refreshMgiStatus(address, wallet.subOrgId, id));
      } catch {
        /* next tick */
      }
    }, 15_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committed?.id, committed?.status, address, isFocused]);

  const refresh = async () => {
    if (!committed || !address || !wallet?.subOrgId || refreshing) return;
    setRefreshing(true);
    try {
      applyTx(committed.id, await refreshMgiStatus(address, wallet.subOrgId, committed.id));
      void queryClient.invalidateQueries({ queryKey: mgiTransactionsQueryKey(user?.id) });
    } catch (e) {
      if (!isUserCancelledError(e)) Alert.alert("Couldn’t refresh", e instanceof Error ? e.message : describeTurnkeyError(e));
    } finally {
      setRefreshing(false);
    }
  };

  const inputStyle = { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: radius.input, color: c.ink, paddingHorizontal: 14 } as const;
  const needsPayment = committed?.status === "pending_user_transfer_start" && !committed.txHash;
  const failed = committed ? FAILED_MGI_STATUSES.has(committed.status) : false;
  const done = committed?.status === "completed";

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps='handled' contentContainerStyle={{ paddingBottom: 48 }}>
          <YStack paddingHorizontal={space.gutter} paddingTop={insets.top + 8} gap={16}>
            <XStack alignItems='center' gap={4} marginLeft={-10}>
              <IconButton onPress={() => router.back()} label='Back'><ChevronLeft size={22} color={c.ink} strokeWidth={2} /></IconButton>
              <UiText fontSize={22} fontWeight='600' letterSpacing={tracking(22)}>{committed ? "Complete your cash-out" : "Cash out at MoneyGram"}</UiText>
            </XStack>

            {busy === "resuming" ? (
              <Card padding={20} alignItems='center' gap={8}>
                <UiText fontSize={15} fontWeight='500'>Loading your cash-out…</UiText>
                <UiText fontSize={13} color={c.muted}>Checking its status with MoneyGram.</UiText>
              </Card>
            ) : committed ? (
              <>
                <Card padding={16} gap={12} backgroundColor={done ? c.chips.green.bg : failed ? c.chips.amber.bg : c.chips.blue.bg} borderColor='transparent'>
                  <XStack alignItems='center' gap={10}>
                    <Banknote size={20} color={c.ink} strokeWidth={1.8} />
                    <UiText fontSize={15} fontWeight='600' flex={1}>
                      {done ? "Cash is ready for pickup" : failed ? "This cash-out is no longer active" : needsPayment ? "Send the USDC to MoneyGram" : "MoneyGram is preparing your cash"}
                    </UiText>
                  </XStack>
                  <UiText fontSize={13.5} color={c.ink2} lineHeight={19}>
                    {done
                      ? "MoneyGram received your USDC. Collect the cash at the location you selected, with the reference number below and your ID."
                      : failed
                        ? `MoneyGram reports this cash-out as ${mgiStatusLabel(committed.status).toLowerCase()}. Nothing further will happen; start a new one if needed.`
                        : needsPayment
                          ? "MoneyGram reserved your cash-out. One passkey confirmation sends exactly the requested USDC to MoneyGram’s Stellar account with the memo they need."
                          : "Your USDC is on its way to MoneyGram. The cash becomes available for pickup shortly — you can close this screen; the cash-out stays in Activity."}
                  </UiText>
                </Card>
                <Card paddingTop={4} paddingHorizontal={4} paddingBottom={4}>
                  <XStack paddingHorizontal={space.rowX} paddingVertical={space.rowY} justifyContent='space-between'><UiText fontSize={13.5} color={c.muted}>Amount</UiText><Mono fontSize={14}>{fNumber(committed.amount, { maximumFractionDigits: 7 })} USDC</Mono></XStack>
                  <Divider />
                  <XStack paddingHorizontal={space.rowX} paddingVertical={space.rowY} justifyContent='space-between' alignItems='center'><UiText fontSize={13.5} color={c.muted}>Status</UiText><Chip tone={done ? "green" : failed ? "amber" : "blue"} label={mgiStatusLabel(committed.status)} /></XStack>
                  {committed.anchorAccount ? (
                    <>
                      <Divider />
                      <XStack paddingHorizontal={space.rowX} paddingVertical={space.rowY} justifyContent='space-between'><UiText fontSize={13.5} color={c.muted}>To (MoneyGram)</UiText><Mono fontSize={12}>{shorten(committed.anchorAccount)}</Mono></XStack>
                    </>
                  ) : null}
                  {committed.memo ? (
                    <>
                      <Divider />
                      <XStack paddingHorizontal={space.rowX} paddingVertical={space.rowY} justifyContent='space-between'><UiText fontSize={13.5} color={c.muted}>Memo</UiText><Mono fontSize={12}>{committed.memo}</Mono></XStack>
                    </>
                  ) : null}
                  {committed.reference ? (
                    <>
                      <Divider />
                      <XStack paddingHorizontal={space.rowX} paddingVertical={space.rowY} justifyContent='space-between'><UiText fontSize={13.5} color={c.muted}>Reference number</UiText><Mono fontSize={14} fontWeight='600'>{committed.reference}</Mono></XStack>
                    </>
                  ) : null}
                  {committed.txHash ? (
                    <>
                      <Divider />
                      <XStack paddingHorizontal={space.rowX} paddingVertical={space.rowY} justifyContent='space-between'><UiText fontSize={13.5} color={c.muted}>Payment</UiText><Mono fontSize={12} color={c.muted}>{shorten(committed.txHash)}</Mono></XStack>
                    </>
                  ) : null}
                </Card>
                <YStack gap={10}>
                  {needsPayment ? (
                    <PrimaryButton label={busy === "sending" ? "Sending with passkey…" : `Send ${fNumber(committed.amount, { maximumFractionDigits: 7 })} USDC with passkey`} onPress={() => void sendUsdc()} loading={busy === "sending"} disabled={!committed.anchorAccount} />
                  ) : null}
                  <SecondaryButton label='Open MoneyGram details' onPress={() => address && wallet?.subOrgId && void openMgiDetails(address, wallet.subOrgId, committed.id).catch((e) => Alert.alert("Couldn’t open MoneyGram", e instanceof Error ? e.message : "Please try again."))} />
                  <SecondaryButton label={refreshing ? "Refreshing…" : "Refresh status"} onPress={() => void refresh()} disabled={refreshing} />
                  <SecondaryButton label='Done' onPress={() => router.back()} />
                </YStack>
              </>
            ) : !address ? (
              <Card padding={14} gap={8}>
                <UiText fontSize={14} fontWeight='600'>Cash-out runs from your Stellar USDC</UiText>
                <UiText fontSize={13} color={c.muted} lineHeight={18}>Add Stellar to your wallet and hold some USDC first.</UiText>
              </Card>
            ) : (
              <>
                <Card padding={14} gap={12}>
                  <XStack justifyContent='space-between' alignItems='center'>
                    <UiText fontSize={12} color={c.muted}>Amount (USDC → cash)</UiText>
                    <Mono fontSize={11} color={c.muted}>{fNumber(usdcBalance, { maximumFractionDigits: 2 })} USDC available</Mono>
                  </XStack>
                  <XStack alignItems='center' gap={10}>
                    <Mono fontSize={28} color={c.muted} letterSpacing={tracking(28)}>$</Mono>
                    <Input {...inputStyle} flex={1} height={56} fontFamily='$mono' fontSize={28} letterSpacing={tracking(28)} placeholder='0' keyboardType='decimal-pad' value={amount} onChangeText={setAmount} editable={!busy} />
                    <PillButton label='Max' onPress={() => setAmount(String(Math.min(Math.floor(usdcBalance * 100) / 100, limits.max)))} />
                  </XStack>
                  <XStack gap={6} flexWrap='wrap'>
                    {presets.map((p) => (
                      <PillButton key={p} label={`$${p}`} onPress={() => setAmount(String(p))} />
                    ))}
                  </XStack>
                  <UiText fontSize={12} color={(amount && !amountOk) || insufficient ? c.failed : c.muted}>
                    {insufficient ? "That’s more USDC than you hold." : `MoneyGram pays out ${fCurrency(limits.min)}–${fCurrency(limits.max)} per cash-out, 1 USDC = $1.`}
                  </UiText>
                </Card>
                <Card padding={14} gap={8}>
                  <UiText fontSize={14} fontWeight='600'>How it works</UiText>
                  <UiText fontSize={13} color={c.muted} lineHeight={18}>1. Sign in to MoneyGram with your passkey (one confirmation).</UiText>
                  <UiText fontSize={13} color={c.muted} lineHeight={18}>2. Choose a pickup location on their page and confirm.</UiText>
                  <UiText fontSize={13} color={c.muted} lineHeight={18}>3. Back here, one passkey sends the USDC to MoneyGram. Collect the cash with your reference number and ID.</UiText>
                </Card>
                <PrimaryButton label={busy === "signin" ? "Signing in to MoneyGram…" : busy === "open" ? "Opening MoneyGram…" : "Continue with MoneyGram"} onPress={() => void start()} disabled={!amountOk || insufficient || !!busy} loading={busy === "signin" || busy === "open"} />
              </>
            )}
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
