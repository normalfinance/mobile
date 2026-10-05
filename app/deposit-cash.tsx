// Deposit cash with MoneyGram (web onramp-dialog.tsx MoneyGram path + Q42):
// amount within MoneyGram's live limits → SEP-10 sign-in (one passkey, cached)
// → SEP-24 interactive deposit opened in the in-app browser → the app polls
// the transaction while the page is open and switches to "Drop off your cash"
// the moment MoneyGram reports the commit. USDC on Stellar only: the account
// must be active with a USDC trustline first (web prerequisitesMet).

import React from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Input, XStack, YStack } from "tamagui";
import { ChevronLeft, HandCoins } from "lucide-react-native";

import { Card, Chip, Divider, IconButton, Mono, PillButton, PrimaryButton, Screen, SecondaryButton, UiText } from "@/components/home/primitives";
import { ReceiveSheet } from "@/components/home/ReceiveSheet";
import { useMgiLimits, mgiTransactionsQueryKey } from "@/hooks/use-mgi";
import { useStellarAccountProbe } from "@/hooks/use-savings";
import { turnkeyWalletQueryKey, useTurnkeyWallet, walletAddresses } from "@/hooks/use-turnkey-wallet";
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
  startMgiDeposit,
  watchMgiCommit,
  type Sep24Transaction
} from "@/lib/ramp/moneygram";
import { addUsdcTrustline, deriveSetupStep } from "@/lib/savings/engine";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";
import { describeTurnkeyError, isUserCancelledError } from "@/lib/turnkey/client";
import { ensureDeviceReady } from "@/lib/turnkey/device-check";
import { useDeviceReady } from "@/lib/turnkey/device-ready";
import { provisionChain } from "@/lib/turnkey/provision";
import { fCurrency } from "@/lib/utils/number-format.utils";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

const PRESETS = [20, 50, 100, 250];

type Committed = { id: string; amount: number; status: string; reference: string | null };

export default function DepositCashScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();
  const { user } = useSupabaseAuth();
  const { wallet, refetch: refetchWallet } = useTurnkeyWallet();
  const address = wallet?.stellarAddress ?? null;
  const { ready: deviceReady } = useDeviceReady(wallet?.subOrgId);
  const limits = useMgiLimits().deposit;

  const [amount, setAmount] = React.useState(String(PRESETS[1]));
  const [busy, setBusy] = React.useState<null | "signin" | "open" | "trustline" | "stellar">(null);
  const [committed, setCommitted] = React.useState<Committed | null>(null);
  const [receiveOpen, setReceiveOpen] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  // Prerequisites (web useAccountStatus): active account + USDC trustline.
  const probe = useStellarAccountProbe(address, isFocused && !committed);
  const step = deriveSetupStep(probe.data ?? null);

  const amountNum = Number(amount.replace(",", "."));
  const amountOk = Number.isFinite(amountNum) && amountNum >= limits.min && amountNum <= limits.max;
  const presets = PRESETS.filter((p) => p >= limits.min && p <= limits.max);

  const addStellar = async () => {
    if (!user) return;
    setBusy("stellar");
    try {
      const updated = await provisionChain({ user, wallet, chain: "stellar" });
      queryClient.setQueryData(turnkeyWalletQueryKey(user.id), updated);
      await refetchWallet();
    } catch (e) {
      if (!isUserCancelledError(e)) Alert.alert("Couldn’t add Stellar", describeTurnkeyError(e));
    } finally {
      setBusy(null);
    }
  };

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

  const addTrustline = async () => {
    if (!wallet?.subOrgId || !address) return;
    setBusy("trustline");
    try {
      if (!(await gate())) return;
      await addUsdcTrustline({ subOrgId: wallet.subOrgId, address });
      await probe.refetch();
      refreshAfterStellarAction(queryClient, { userId: user?.id, stellarAddress: address });
    } catch (e) {
      if (!isUserCancelledError(e)) Alert.alert("Couldn’t add the trustline", e instanceof Error ? e.message : describeTurnkeyError(e));
    } finally {
      setBusy(null);
    }
  };

  const applyTx = (id: string, tx: Sep24Transaction) =>
    setCommitted((prev) => ({ id, amount: prev?.amount ?? amountNum, status: tx.status, reference: tx.external_transaction_id ? String(tx.external_transaction_id) : prev?.reference ?? null }));

  const start = async () => {
    if (!wallet?.subOrgId || !address || !amountOk) return;
    try {
      if (!(await gate())) return;
      // 1) SEP-10: one passkey prompt unless a token is still cached.
      setBusy("signin");
      const token = await getMgiAuthToken(address, wallet.subOrgId);
      // 2) SEP-24 interactive deposit; our DB row is created 'incomplete'.
      setBusy("open");
      const { url, id } = await startMgiDeposit(token, address, amountNum);
      void queryClient.invalidateQueries({ queryKey: mgiTransactionsQueryKey(user?.id) });
      // 3) MoneyGram's page in the in-app browser; poll the transaction while
      //    it is open (web learns this by postMessage, which the app can't).
      let closed = false;
      const watcher = id ? watchMgiCommit(address, id, token, { until: () => closed, onStatus: (tx) => tx.status !== "incomplete" && applyTx(id, tx) }) : Promise.resolve(null);
      await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN });
      closed = true;
      let result = await watcher;
      if (!result && id) {
        // One final read after the page closed — the commit may have landed
        // between the last tick and the close.
        try {
          const tx = await getMgiTransaction(address, id, token);
          if (tx.status !== "incomplete") result = tx;
        } catch {
          /* leave as not committed */
        }
      }
      if (result && id) applyTx(id, result);
      else if (!id) Alert.alert("MoneyGram opened", "If you confirmed a deposit, it will appear in Activity once MoneyGram reports it.");
      else Alert.alert("Nothing started", "You closed MoneyGram before confirming a deposit. Nothing was charged — start again whenever you’re ready.");
      void queryClient.invalidateQueries({ queryKey: mgiTransactionsQueryKey(user?.id) });
    } catch (e) {
      if (!isUserCancelledError(e)) Alert.alert("Couldn’t start the deposit", e instanceof Error ? e.message : describeTurnkeyError(e));
    } finally {
      setBusy(null);
    }
  };

  // Watch the committed deposit every 15 s while this screen is open — with
  // the cached token ONLY (never a background passkey prompt), like web.
  React.useEffect(() => {
    if (!committed || !address || TERMINAL_MGI_STATUSES.has(committed.status) || !isFocused) return;
    const id = committed.id;
    const iv = setInterval(async () => {
      if (!(await hasCachedMgiToken(address))) return;
      try {
        const tx = await refreshMgiStatus(address, wallet!.subOrgId, id);
        applyTx(id, tx);
        if (tx.status === "completed") {
          refreshAfterStellarAction(queryClient, { userId: user?.id, stellarAddress: address });
          void queryClient.invalidateQueries({ queryKey: ["activity"] });
        }
      } catch {
        /* transient — next tick retries */
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
  const failed = committed ? FAILED_MGI_STATUSES.has(committed.status) : false;
  const done = committed?.status === "completed";

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps='handled' contentContainerStyle={{ paddingBottom: 48 }}>
          <YStack paddingHorizontal={space.gutter} paddingTop={insets.top + 8} gap={16}>
            <XStack alignItems='center' gap={4} marginLeft={-10}>
              <IconButton onPress={() => router.back()} label='Back'><ChevronLeft size={22} color={c.ink} strokeWidth={2} /></IconButton>
              <UiText fontSize={22} fontWeight='600' letterSpacing={tracking(22)}>{committed ? "Complete your cash deposit" : "Deposit cash"}</UiText>
            </XStack>

            {committed ? (
              <>
                <Card padding={16} gap={12} backgroundColor={done ? c.chips.green.bg : failed ? c.chips.amber.bg : c.chips.blue.bg} borderColor='transparent'>
                  <XStack alignItems='center' gap={10}>
                    <HandCoins size={20} color={c.ink} strokeWidth={1.8} />
                    <UiText fontSize={15} fontWeight='600' flex={1}>{done ? "Cash received — USDC delivered" : failed ? "This deposit is no longer active" : "Drop off your cash"}</UiText>
                  </XStack>
                  <UiText fontSize={13.5} color={c.ink2} lineHeight={19}>
                    {done
                      ? "MoneyGram received your cash and the USDC has been sent to your wallet."
                      : failed
                        ? `MoneyGram reports this deposit as ${mgiStatusLabel(committed.status).toLowerCase()}. Start a new deposit if needed.`
                        : "Drop off the cash at the MoneyGram location you selected — no code needed. Your USDC arrives shortly after paying. You can close this screen; the deposit stays in Activity."}
                  </UiText>
                </Card>
                <Card paddingTop={4} paddingHorizontal={4} paddingBottom={4}>
                  <XStack paddingHorizontal={space.rowX} paddingVertical={space.rowY} justifyContent='space-between'><UiText fontSize={13.5} color={c.muted}>Amount</UiText><Mono fontSize={14}>{fCurrency(committed.amount)} USDC</Mono></XStack>
                  <Divider />
                  <XStack paddingHorizontal={space.rowX} paddingVertical={space.rowY} justifyContent='space-between' alignItems='center'><UiText fontSize={13.5} color={c.muted}>Status</UiText><Chip tone={done ? "green" : failed ? "amber" : "blue"} label={mgiStatusLabel(committed.status)} /></XStack>
                  {committed.reference ? (
                    <>
                      <Divider />
                      <XStack paddingHorizontal={space.rowX} paddingVertical={space.rowY} justifyContent='space-between'><UiText fontSize={13.5} color={c.muted}>Reference number</UiText><Mono fontSize={14} fontWeight='600'>{committed.reference}</Mono></XStack>
                    </>
                  ) : null}
                  <Divider />
                  <XStack paddingHorizontal={space.rowX} paddingVertical={space.rowY} justifyContent='space-between'><UiText fontSize={13.5} color={c.muted}>Transaction ID</UiText><Mono fontSize={12} color={c.muted}>{committed.id.slice(0, 8)}…</Mono></XStack>
                </Card>
                <YStack gap={10}>
                  <PrimaryButton label='Open MoneyGram details' onPress={() => address && wallet?.subOrgId && void openMgiDetails(address, wallet.subOrgId, committed.id).catch((e) => Alert.alert("Couldn’t open MoneyGram", e instanceof Error ? e.message : "Please try again."))} />
                  <SecondaryButton label={refreshing ? "Refreshing…" : "Refresh status"} onPress={() => void refresh()} disabled={refreshing} />
                  <SecondaryButton label='Done' onPress={() => router.back()} />
                </YStack>
              </>
            ) : !address ? (
              <Card padding={14} gap={10}>
                <UiText fontSize={14} fontWeight='600'>MoneyGram delivers USDC on Stellar</UiText>
                <UiText fontSize={13} color={c.muted} lineHeight={18}>{wallet ? "Add Stellar to your wallet first — one passkey confirmation." : "Create your wallet first — one passkey confirmation."}</UiText>
                <PrimaryButton label={busy === "stellar" ? "Confirm with your passkey…" : wallet ? "Add Stellar" : "Set up wallet"} onPress={() => void addStellar()} loading={busy === "stellar"} />
              </Card>
            ) : step && step !== "ready" ? (
              <Card padding={14} gap={10}>
                <UiText fontSize={14} fontWeight='600'>{step === "activate" ? "Activate your Stellar account first" : "Add the USDC trustline first"}</UiText>
                <UiText fontSize={13} color={c.muted} lineHeight={18}>
                  {step === "activate"
                    ? "MoneyGram sends USDC to your Stellar account, which needs a little XLM before it can hold anything. Buy or receive XLM, then come back."
                    : "Your account can’t hold USDC until it has a trustline — one passkey confirmation."}
                </UiText>
                {step === "activate" ? (
                  <XStack gap={8}>
                    <PillButton label='Buy XLM' onPress={() => router.push("/buy?asset=XLM")} />
                    <PillButton label='Receive XLM' onPress={() => setReceiveOpen(true)} />
                  </XStack>
                ) : (
                  <PrimaryButton label={busy === "trustline" ? "Confirm with your passkey…" : "Add USDC trustline"} onPress={() => void addTrustline()} loading={busy === "trustline"} />
                )}
              </Card>
            ) : (
              <>
                <Card padding={14} gap={12}>
                  <UiText fontSize={12} color={c.muted}>Amount (USD → USDC)</UiText>
                  <XStack alignItems='center' gap={10}>
                    <Mono fontSize={28} color={c.muted} letterSpacing={tracking(28)}>$</Mono>
                    <Input {...inputStyle} flex={1} height={56} fontFamily='$mono' fontSize={28} letterSpacing={tracking(28)} placeholder='0' keyboardType='decimal-pad' value={amount} onChangeText={setAmount} editable={!busy} />
                  </XStack>
                  <XStack gap={6} flexWrap='wrap'>
                    {presets.map((p) => (
                      <PillButton key={p} label={`$${p}`} onPress={() => setAmount(String(p))} />
                    ))}
                  </XStack>
                  <UiText fontSize={12} color={amount && !amountOk ? c.failed : c.muted}>
                    MoneyGram accepts {fCurrency(limits.min)}–{fCurrency(limits.max)} per cash deposit.
                  </UiText>
                </Card>
                <Card padding={14} gap={8}>
                  <UiText fontSize={14} fontWeight='600'>How it works</UiText>
                  <UiText fontSize={13} color={c.muted} lineHeight={18}>1. Sign in to MoneyGram with your passkey (one confirmation).</UiText>
                  <UiText fontSize={13} color={c.muted} lineHeight={18}>2. Choose a MoneyGram location on their page and confirm the deposit.</UiText>
                  <UiText fontSize={13} color={c.muted} lineHeight={18}>3. Drop off the cash there. USDC lands in your wallet shortly after.</UiText>
                </Card>
                <PrimaryButton label={busy === "signin" ? "Signing in to MoneyGram…" : busy === "open" ? "Opening MoneyGram…" : "Continue with MoneyGram"} onPress={() => void start()} disabled={!amountOk || !!busy} loading={busy === "signin" || busy === "open"} />
              </>
            )}
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>
      <ReceiveSheet open={receiveOpen} addresses={walletAddresses(wallet)} initialChain='stellar' onClose={() => setReceiveOpen(false)} />
    </Screen>
  );
}
