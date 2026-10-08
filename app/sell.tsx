// Sell — cash out via Coinbase Offramp (web offramp-dialog + coinbase-offramp-modal).
// Two halves on one screen: pick asset + amount → Coinbase sheet; back in the
// app, find the order Coinbase created, send exactly its amount to its address
// with one passkey, then wait for Coinbase to pay out. `?asset=` preselects;
// `?resume=1` skips straight to finding a pending order.

import React from "react";
import { Alert, ScrollView } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Input, XStack, YStack } from "tamagui";
import { Check, ChevronLeft, ExternalLink } from "lucide-react-native";

import { AssetIcon } from "@/components/ui/AssetIcon";
import { Card, IconBox, IconButton, Mono, PillButton, PrimaryButton, Screen, SecondaryButton, UiText } from "@/components/home/primitives";
import { useBackendPortfolio } from "@/hooks/use-backend-portfolio";
import { useSavingsPosition, useStellarAccountProbe } from "@/hooks/use-savings";
import { useTurnkeyWallet, type WalletChain } from "@/hooks/use-turnkey-wallet";
import { refreshAfterStellarAction } from "@/lib/data/after-action";
import { createCoinbaseSession } from "@/lib/ramp/coinbase";
import {
  SELL_ASSETS,
  SELL_RETURN_URL,
  SELL_SEND_RESERVE,
  SELL_STATIC_RESERVE,
  btcSellReserve,
  claimFill,
  createCoinbaseSellURL,
  fetchFills,
  fetchOfframpStatus,
  pickPendingSell,
  recordFill,
  recordOfframpHandoff,
  releaseFill,
  settleOfframpHandoff,
  sellMax,
  terminalLabel,
  xlmSellReserve,
  type OfframpTx,
  type SellAsset
} from "@/lib/ramp/offramp";
import { sendBtc } from "@/lib/send/bitcoin";
import { sendEth } from "@/lib/send/evm";
import { sendSol } from "@/lib/send/solana";
import { sendStellar } from "@/lib/stellar/send";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";
import { describeTurnkeyError, isUserCancelledError } from "@/lib/turnkey/client";
import { ensureDeviceReady, signingAddressOf } from "@/lib/turnkey/device-check";
import { useDeviceReady } from "@/lib/turnkey/device-ready";
import { fCurrency, fNumber } from "@/lib/utils/number-format.utils";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

const ADDRESS_FIELD: Record<WalletChain, "stellarAddress" | "bitcoinAddress" | "ethereumAddress" | "solanaAddress"> = {
  stellar: "stellarAddress",
  bitcoin: "bitcoinAddress",
  ethereum: "ethereumAddress",
  solana: "solanaAddress"
};
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const shorten = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;

type Phase = "amount" | "searching" | "none" | "ready" | "sending" | "confirming" | "done" | "failed" | "slow";

export default function SellScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ asset?: string; resume?: string }>();
  const { user } = useSupabaseAuth();
  const { wallet } = useTurnkeyWallet();
  const { ready: deviceReady } = useDeviceReady(wallet?.subOrgId);
  const { portfolioData } = useBackendPortfolio();

  const initial = SELL_ASSETS.find((a) => a.asset === (params.asset ?? "").toUpperCase())?.asset ?? "USDC";
  const [asset, setAsset] = React.useState<SellAsset>(initial);
  const meta = SELL_ASSETS.find((a) => a.asset === asset)!;
  const address = wallet ? wallet[ADDRESS_FIELD[meta.chain]] : null;
  const row = portfolioData.assets.find((a) => a.asset_code === asset);
  const balance = Number(row?.balance ?? 0);
  const price = row?.usdPrice ?? (asset === "USDC" ? 1 : 0);
  const held = SELL_ASSETS.filter((a) => Number(portfolioData.assets.find((p) => p.asset_code === a.asset)?.balance ?? 0) > 0);
  const probe = useStellarAccountProbe(meta.chain === "stellar" ? wallet?.stellarAddress : null, false);
  const { hasActiveSavings } = useSavingsPosition(wallet?.stellarAddress);

  // Reserve for MAX (web offramp-dialog): live for BTC and XLM.
  const [reserve, setReserve] = React.useState<number>(SELL_STATIC_RESERVE[initial]);
  React.useEffect(() => {
    if (asset === "BTC") void btcSellReserve().then(setReserve);
    else if (asset === "XLM") setReserve(xlmSellReserve(probe.data ? probe.data.subentryCount : null));
    else setReserve(SELL_STATIC_RESERVE[asset]);
  }, [asset, probe.data]);
  const max = sellMax(balance, reserve);

  const [amount, setAmount] = React.useState("");
  const amountNum = Number(amount.replace(",", "."));
  const amountOk = Number.isFinite(amountNum) && amountNum > 0;
  const overMax = amountOk && amountNum > max + 1e-9;

  const [phase, setPhase] = React.useState<Phase>(params.resume ? "searching" : "amount");
  const [busy, setBusy] = React.useState(false);
  const [order, setOrder] = React.useState<OfframpTx | null>(null);
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const handoffAt = React.useRef<number | null>(null);
  const handoffAmount = React.useRef<number | null>(null);
  const rampRowId = React.useRef<string | null>(null);

  // --- step 2: open Coinbase -------------------------------------------------
  const openCoinbase = async () => {
    if (!wallet || !address || !user?.id || !amountOk) return;
    setBusy(true);
    try {
      const value = Math.min(amountNum, max);
      const token = await createCoinbaseSession(address, asset, meta.chain);
      void recordOfframpHandoff({ asset, chain: meta.chain, walletAddress: address, amount: value, baselineBalance: balance }).then((id) => (rampRowId.current = id));
      const url = createCoinbaseSellURL({ sessionToken: token, partnerUserRef: user.id, asset, chain: meta.chain, amount: value, redirectUrl: SELL_RETURN_URL });
      handoffAt.current = Date.now();
      handoffAmount.current = value;
      // Single-use token: open exactly once. Ephemeral → no iOS consent alert.
      await WebBrowser.openAuthSessionAsync(url, SELL_RETURN_URL, { preferEphemeralSession: true });
      // Returned (or dismissed) — either way, look for the order Coinbase created.
      await findOrder();
    } catch (e) {
      Alert.alert("Couldn’t start the sale", e instanceof Error ? e.message : "Failed to start Coinbase checkout. Try again later.");
      setBusy(false);
    }
  };

  // --- step 4: find the STARTED order --------------------------------------------
  const findOrder = async () => {
    setPhase("searching");
    setBusy(true);
    try {
      const fills = await fetchFills();
      for (let i = 0; i < 10; i += 1) {
        const txs = await fetchOfframpStatus().catch(() => [] as OfframpTx[]);
        const found = pickPendingSell(txs, fills, { asset, balance, since: handoffAt.current, handedOff: handoffAmount.current });
        if (found) {
          setOrder(found.tx);
          if (found.alreadyFilled) {
            setTxHash(fills.find((f) => f.providerTxnId === found.tx.transactionId)?.txHash ?? null);
            setPhase("confirming");
            void confirmPayout(found.tx.transactionId!);
          } else setPhase("ready");
          return;
        }
        await delay(3_000);
      }
      setPhase("none");
    } finally {
      setBusy(false);
    }
  };

  // --- step 5: send Coinbase's amount to Coinbase's address ---------------------
  const sendToCoinbase = async () => {
    if (!order?.transactionId || !order.toAddress || !order.amount || !wallet?.subOrgId || !address) return;
    const id = order.transactionId;
    const value = parseFloat(order.amount);
    setBusy(true);
    setNotice(null);
    try {
      // Never send twice: a fill with a hash means it already left.
      const existing = (await fetchFills()).find((f) => f.providerTxnId === id);
      if (existing?.txHash) {
        setTxHash(existing.txHash);
        setPhase("confirming");
        void confirmPayout(id);
        return;
      }
      // Native chains: the send must leave the network reserve behind (web pre-flight).
      if (asset === "BTC" || asset === "ETH" || asset === "SOL") {
        const spendable = balance - SELL_SEND_RESERVE[asset];
        if (value > spendable + 1e-9) {
          const avail = Math.max(Math.floor(spendable * 1e6) / 1e6, 0);
          throw new Error(`This order is for ${value} ${asset}, more than your balance can send after the network reserve. You can sell at most about ${avail} ${asset} right now — start a new sale on Coinbase and enter ${avail} (or less) instead of using Max.`);
        }
      }
      const gate = await ensureDeviceReady(wallet.subOrgId, signingAddressOf(wallet) ?? address, deviceReady);
      if (gate.outcome === "needs-setup") {
        router.push("/setup-device");
        return;
      }
      if (gate.outcome === "cancelled") return;
      if (gate.outcome === "failed") throw gate.error;

      setPhase("sending");
      await claimFill(id);
      let hash: string;
      try {
        if (meta.chain === "stellar") {
          // Coinbase's memo if given; without one, sendStellar's memo guard
          // (seed list + SEP-29) refuses exchange-like destinations itself.
          const r = await sendStellar({ subOrgId: wallet.subOrgId, from: address, symbol: asset as "XLM" | "USDC", amount: value, destination: order.toAddress, memo: order.memo != null ? String(order.memo) : undefined, hasActiveSavings });
          hash = r.hash;
        } else if (asset === "ETH") hash = await sendEth({ subOrgId: wallet.subOrgId, from: address, to: order.toAddress, amount: value, balance });
        else if (asset === "SOL") hash = await sendSol({ subOrgId: wallet.subOrgId, from: address, to: order.toAddress, amount: value });
        else hash = await sendBtc({ from: address, to: order.toAddress, amount: value });
      } catch (e) {
        await releaseFill(id);
        throw e;
      }
      await recordFill(id, hash);
      // The on-chain Sent row (relabelled "Sell · Coinbase" via the fill) is the
      // record from here; the hand-off tracking row moves forward so Activity
      // does not show the same sale twice.
      void settleOfframpHandoff(rampRowId.current, "provider_complete");
      setTxHash(hash);
      setPhase("confirming");
      void refreshAfterStellarAction(queryClient, { userId: user?.id, stellarAddress: wallet.stellarAddress ?? "", chain: meta.chain === "stellar" ? undefined : meta.chain, chainAddress: meta.chain === "stellar" ? undefined : address, expectMove: [asset] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      void confirmPayout(id);
    } catch (e) {
      if (isUserCancelledError(e)) {
        setPhase("ready");
      } else {
        const m = e instanceof Error ? e.message : describeTurnkeyError(e);
        setNotice(/memo/i.test(m) && !order.memo ? "This destination requires a memo, but Coinbase didn’t provide one — we can’t safely send. Please contact support." : m);
        setPhase("ready");
      }
    } finally {
      setBusy(false);
    }
  };

  // --- step 6: wait for Coinbase to pay out --------------------------------------
  const confirmPayout = async (id: string) => {
    for (let i = 0; i < 30; i += 1) {
      const txs = await fetchOfframpStatus().catch(() => [] as OfframpTx[]);
      const t = terminalLabel(txs.find((x) => x.transactionId === id)?.status);
      if (t === "success") {
        setPhase("done");
        void settleOfframpHandoff(rampRowId.current, "paid_out");
        void queryClient.invalidateQueries({ queryKey: ["activity"] });
        return;
      }
      if (t === "failed") {
        setPhase("failed");
        void settleOfframpHandoff(rampRowId.current, "failed");
        return;
      }
      await delay(10_000);
    }
    setPhase("slow"); // still processing — never shown as success (web defect not copied)
  };

  React.useEffect(() => {
    if (params.resume && wallet) void findOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.subOrgId]);

  const inputStyle = { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: radius.input, paddingHorizontal: 14, color: c.ink, placeholderTextColor: c.faint } as const;
  const title = asset === "USDC" ? "Withdraw cash" : `Sell ${asset}`;

  const header = (
    <XStack alignItems='center' gap={4} marginLeft={-10}>
      <IconButton onPress={() => router.back()} label='Back'><ChevronLeft size={22} color={c.ink} strokeWidth={2} /></IconButton>
      <UiText fontSize={22} fontWeight='600' letterSpacing={tracking(22)}>{phase === "amount" ? "Sell" : title}</UiText>
    </XStack>
  );

  // ---- completion half ------------------------------------------------------------
  if (phase !== "amount") {
    const orderAmount = order?.amount ? parseFloat(order.amount) : null;
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
          <YStack paddingHorizontal={space.gutter} paddingTop={insets.top + 8} gap={20}>
            {header}
            {phase === "searching" ? (
              <Card padding={20} alignItems='center' gap={10}>
                <UiText fontSize={15} fontWeight='500'>Looking for your Coinbase sell order…</UiText>
                <UiText fontSize={13} color={c.muted} textAlign='center'>This takes a few seconds after you confirm on Coinbase.</UiText>
              </Card>
            ) : null}
            {phase === "none" ? (
              <Card padding={20} gap={12}>
                <UiText fontSize={15} fontWeight='500'>No pending cash-out</UiText>
                <UiText fontSize={13} color={c.muted} lineHeight={19}>We didn’t find a pending Coinbase sell order. If you just confirmed one, give it a moment and check again.</UiText>
                <PrimaryButton label='Check again' onPress={() => void findOrder()} loading={busy} />
                <SecondaryButton label='Start over' onPress={() => setPhase("amount")} borderRadius={radius.cta} />
              </Card>
            ) : null}
            {(phase === "ready" || phase === "sending") && order ? (
              <Card padding={16} gap={12}>
                <UiText fontSize={16} fontWeight='600'>Finish your {asset} cash-out</UiText>
                <UiText fontSize={13} color={c.muted} lineHeight={19}>To complete your sale, send the crypto to Coinbase. This needs one passkey confirmation.</UiText>
                <YStack gap={8} paddingVertical={4}>
                  <XStack justifyContent='space-between'><UiText fontSize={13} color={c.muted}>Amount</UiText><Mono fontSize={14}>{orderAmount !== null ? fNumber(orderAmount, { maximumFractionDigits: 8 }) : "—"} {asset}</Mono></XStack>
                  {orderAmount !== null && price > 0 ? <XStack justifyContent='space-between'><UiText fontSize={13} color={c.muted}>Value</UiText><Mono fontSize={14}>≈ {fCurrency(orderAmount * price)}</Mono></XStack> : null}
                  <XStack justifyContent='space-between'><UiText fontSize={13} color={c.muted}>To (Coinbase)</UiText><Mono fontSize={13}>{order.toAddress ? shorten(order.toAddress) : "—"}</Mono></XStack>
                  {order.memo != null && order.memo !== "" ? <XStack justifyContent='space-between'><UiText fontSize={13} color={c.muted}>Memo</UiText><Mono fontSize={13}>{String(order.memo)}</Mono></XStack> : null}
                </YStack>
                {notice ? (
                  <YStack padding={12} borderRadius={radius.input} backgroundColor={c.chips.amber.bg}>
                    <UiText fontSize={13} color={c.chips.amber.color} lineHeight={19}>{notice}</UiText>
                  </YStack>
                ) : null}
                <PrimaryButton label={phase === "sending" ? "Sending…" : "Send with passkey"} onPress={() => void sendToCoinbase()} loading={busy} />
                <SecondaryButton label='Cancel' onPress={() => router.back()} disabled={busy} borderRadius={radius.cta} />
              </Card>
            ) : null}
            {phase === "confirming" || phase === "done" || phase === "failed" || phase === "slow" ? (
              <Card padding={20} alignItems='center' gap={10}>
                <IconBox size={56}><Check size={28} color={phase === "failed" ? c.failed : c.positive} strokeWidth={2} /></IconBox>
                <UiText fontSize={16} fontWeight='500'>
                  {phase === "done" ? "Cash-out complete" : phase === "failed" ? "Cash-out didn’t finish" : phase === "slow" ? "Still processing" : "Crypto sent"}
                </UiText>
                <UiText fontSize={13} color={c.muted} textAlign='center' lineHeight={19}>
                  {phase === "done"
                    ? "Coinbase confirmed the sale — your cash is on its way to your payout method."
                    : phase === "failed"
                      ? "Coinbase reported the sale as failed or expired. If your crypto left the wallet, Coinbase support can trace it with the transaction below."
                      : phase === "slow"
                        ? "Coinbase hasn’t confirmed the payout yet. It usually completes within minutes — check Activity later; nothing else is needed from you."
                        : "Coinbase will pay out your cash once it confirms — you can close this."}
                </UiText>
                {txHash ? <Mono fontSize={11} color={c.faint}>{shorten(txHash)}</Mono> : null}
                <PrimaryButton label='Done' onPress={() => router.back()} />
              </Card>
            ) : null}
          </YStack>
        </ScrollView>
      </Screen>
    );
  }

  // ---- amount half ------------------------------------------------------------
  let button: { label: string; onPress?: () => void; disabled?: boolean; loading?: boolean };
  if (!address) button = { label: `No ${meta.label} in your wallet`, disabled: true };
  else if (balance <= 0) button = { label: `No ${asset} to sell`, disabled: true };
  else if (!amountOk) button = { label: "Enter an amount", disabled: true };
  else if (overMax) button = { label: `Max is ${fNumber(max, { maximumFractionDigits: 6 })} ${asset}`, disabled: true };
  else if (busy) button = { label: "Opening…", loading: true };
  else button = { label: "Continue to Coinbase", onPress: () => void openCoinbase() };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps='handled'>
        <YStack paddingHorizontal={space.gutter} paddingTop={insets.top + 8} gap={20}>
          {header}
          <Card padding={14} gap={12}>
            <UiText fontSize={12} color={c.muted}>Asset</UiText>
            <XStack gap={8} flexWrap='wrap'>
              {(held.length ? held : SELL_ASSETS).map((a) => {
                const selected = a.asset === asset;
                return (
                  <XStack key={a.asset} onPress={() => { setAsset(a.asset); setAmount(""); }} alignItems='center' gap={8} paddingVertical={6} paddingLeft={6} paddingRight={12} borderRadius={radius.pill} borderWidth={1} borderColor={selected ? c.ink : c.border} backgroundColor={selected ? c.ink : "transparent"}>
                    <AssetIcon symbol={a.asset} size={24} fontSize='$2' />
                    <UiText fontSize={13} fontWeight='600' color={selected ? c.ctaText : c.ink}>{a.asset}</UiText>
                  </XStack>
                );
              })}
            </XStack>
            <UiText fontSize={12} color={c.faint}>{meta.label}</UiText>

            <XStack justifyContent='space-between' alignItems='center' marginTop={4}>
              <UiText fontSize={12} color={c.muted}>Amount</UiText>
              <XStack alignItems='center' gap={8}>
                <Mono fontSize={11} color={overMax ? c.failed : c.muted}>Balance {fNumber(balance, { maximumFractionDigits: 6 })} {asset}</Mono>
                <PillButton label='Max' onPress={() => setAmount(String(max))} />
              </XStack>
            </XStack>
            <Input {...inputStyle} height={56} fontFamily='$mono' fontSize={28} letterSpacing={tracking(28)} placeholder='0.00' keyboardType='decimal-pad' value={amount} onChangeText={setAmount} editable={!busy} />
            <XStack justifyContent='space-between'>
              <UiText fontSize={12} color={c.muted}>{amountOk && price > 0 ? `≈ ${fCurrency(amountNum * price)}` : " "}</UiText>
              {reserve > 0 ? <Mono fontSize={11} color={c.faint}>Keeps {fNumber(reserve, { maximumFractionDigits: 6 })} {asset} for fees</Mono> : null}
            </XStack>
          </Card>

          <YStack gap={8}>
            <PrimaryButton label={button.label} onPress={button.onPress} disabled={button.disabled} loading={button.loading} />
            <XStack alignItems='center' justifyContent='center' gap={6}>
              <ExternalLink size={12} color={c.faint} strokeWidth={2} />
              <UiText fontSize={11} color={c.faint} fontFamily='$mono'>You’ll finish the sale on Coinbase, then confirm the send here</UiText>
            </XStack>
            <SecondaryButton label='I already confirmed a sale on Coinbase' onPress={() => void findOrder()} borderRadius={radius.cta} />
            {asset === "USDC" ? (
              <SecondaryButton label='Cash out at a MoneyGram location' onPress={() => router.push("/cash-out")} borderRadius={radius.cta} disabled={busy} />
            ) : null}
          </YStack>
        </YStack>
      </ScrollView>
    </Screen>
  );
}
