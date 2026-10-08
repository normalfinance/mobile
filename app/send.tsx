// Send — XLM/USDC on Stellar (client-side to Horizon, lib/stellar/send.ts),
// ETH/SOL via POST send/execute (lib/send/evm.ts, solana.ts), BTC via the
// server-built PSBT (lib/send/bitcoin.ts). Per-asset display + validation in
// lib/send/registry.ts. Same shape for every chain: form → confirm sheet →
// device gate → sign → submit → result. Every block fires BEFORE the passkey
// prompt; a chain the wallet has no address for is added here (one passkey).

import React from "react";
import { Alert, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Input, XStack, YStack } from "tamagui";
import { Check, ChevronLeft, ClipboardPaste, ScanLine, TriangleAlert, X } from "lucide-react-native";
import { CurrencyToggle } from "@/components/swap/AmountInput";

import { AssetIcon } from "@/components/ui/AssetIcon";
import { QrScanner } from "@/components/send/QrScanner";
import { Card, Divider, IconBox, IconButton, Mono, PillButton, PrimaryButton, Screen, SecondaryButton, UiText } from "@/components/home/primitives";
import { useBackendPortfolio } from "@/hooks/use-backend-portfolio";
import { useSavingsPosition } from "@/hooks/use-savings";
import { turnkeyWalletQueryKey, useTurnkeyWallet, type WalletChain } from "@/hooks/use-turnkey-wallet";
import { refreshAfterStellarAction } from "@/lib/data/after-action";
import { btcBuild, btcMaxSend, sendBtc } from "@/lib/send/bitcoin";
import { GAS_RESERVE_ETH, sendEth, spendableEth } from "@/lib/send/evm";
import { addPendingSend } from "@/lib/send/pending-sends";
import { SEND_ASSETS, SEND_ORDER, parseChainQr, type SendSymbol } from "@/lib/send/registry";
import { SOL_FEE, sendSol, solMaxSend } from "@/lib/send/solana";
import { usePendingOutflow } from "@/lib/spendable";
import { parseStellarQr } from "@/lib/stellar/qr";
import { STELLAR_TX_FEE_XLM, fetchMemoRequirement, loadSource, sendStellar, spendableXlmForOutflow, type MemoRequirement } from "@/lib/stellar/send";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";
import { provisionChain } from "@/lib/turnkey/provision";
import { describeTurnkeyError, isUserCancelledError } from "@/lib/turnkey/client";
import { ensureDeviceReady } from "@/lib/turnkey/device-check";
import { useDeviceReady } from "@/lib/turnkey/device-ready";
import { fAssetQuantity, fCurrency, shortenAddress } from "@/lib/utils/number-format.utils";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

type Step = "checking" | "building" | "signing" | "submitting";
const STEP_LABEL: Record<Step, string> = {
  checking: "Checking balances…",
  building: "Preparing transaction…",
  signing: "Waiting for your passkey…",
  submitting: "Sending to the network…"
};
const ADDRESS_FIELD: Record<WalletChain, "stellarAddress" | "bitcoinAddress" | "ethereumAddress" | "solanaAddress"> = {
  stellar: "stellarAddress",
  bitcoin: "bitcoinAddress",
  ethereum: "ethereumAddress",
  solana: "solanaAddress"
};
const DECIMALS: Record<SendSymbol, number> = { XLM: 7, USDC: 7, BTC: 8, ETH: 18, SOL: 9 };
// Floor, never round: toFixed rounds half-up, so MAX could land a hair ABOVE
// the spendable figure and trip "exceeds what you can send" (live 2026-10-08:
// 6.14841969… XLM became 6.1484197). The 1e-3 nudge absorbs binary float
// representation (6.1484197 × 1e7 = 61484196.99999…).
// Spendable is a float difference (balance − reserve − fee); MAX writes it at
// display precision. Compare with half a unit of the finest precision (1e-8)
// so 6.1484197 is never "more than" 6.148419699999999 (live 2026-10-08).
const EPS = 5e-8;
const trim = (v: number, d: number) => {
  const f = 10 ** d;
  return (Math.floor(Number((v * f).toFixed(3))) / f).toFixed(d).replace(/\.?0+$/, "") || "0";
};

export default function SendScreen() {
  const c = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ symbol?: string }>();
  const { user } = useSupabaseAuth();
  const { wallet, refetch: refetchWallet } = useTurnkeyWallet();
  const { ready: deviceReady } = useDeviceReady(wallet?.subOrgId);
  const { portfolioData } = useBackendPortfolio();
  const { hasActiveSavings } = useSavingsPosition(wallet?.stellarAddress);

  const initial = (params.symbol ?? "XLM").toUpperCase() as SendSymbol;
  const [symbol, setSymbol] = React.useState<SendSymbol>(SEND_ORDER.includes(initial) ? initial : "XLM");
  const meta = SEND_ASSETS[symbol];
  const isStellar = meta.chain === "stellar";
  const from = wallet ? wallet[ADDRESS_FIELD[meta.chain]] : null;

  const [amount, setAmount] = React.useState("");
  const [destination, setDestination] = React.useState("");
  const [memo, setMemo] = React.useState("");
  const [memoReq, setMemoReq] = React.useState<MemoRequirement | null>(null);
  const [spendableRaw, setSpendable] = React.useState<number | null>(null);
  // Web send-modal: type in USD or in the coin; the coin amount stays canonical.
  const [fiat, setFiat] = React.useState(false);
  const [usdText, setUsdText] = React.useState("");
  // Web review step: "I have verified the address and amount" before signing.
  const [verified, setVerified] = React.useState(false);
  const [feePreview, setFeePreview] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [scanning, setScanning] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [addingChain, setAddingChain] = React.useState(false);
  const [step, setStep] = React.useState<Step | null>(null);
  const [result, setResult] = React.useState<{ hash: string } | null>(null);

  const asset = portfolioData.assets.find((a) => a.asset_code === symbol);
  const price = asset?.usdPrice ?? 0;
  // #62: never offer money an in-flight send/swap is already moving.
  const outflow = usePendingOutflow(meta.chain, symbol);
  const spendable = spendableRaw === null ? null : Math.max(spendableRaw - outflow, 0);
  const onAmountText = (v: string) => {
    if (fiat) {
      setUsdText(v);
      const usd = Number(v.replace(",", "."));
      setAmount(price > 0 && Number.isFinite(usd) && usd > 0 ? trim(usd / price, DECIMALS[symbol]) : "");
    } else setAmount(v);
  };
  const toggleFiat = () => {
    if (!price) return;
    const n = Number(amount.replace(",", "."));
    if (!fiat) setUsdText(Number.isFinite(n) && n > 0 ? (n * price).toFixed(2) : "");
    setFiat((f) => !f);
  };
  const balance = Number(asset?.balance ?? 0);
  const amountNum = Number(amount.replace(",", "."));
  const amountOk = Number.isFinite(amountNum) && amountNum > 0;
  const destTrim = isStellar ? destination.trim().toUpperCase() : destination.trim();
  const destOk = meta.validateAddress(destTrim) && destTrim !== from;
  const memoMissing = isStellar && !!memoReq?.required && !memo.trim();

  // Spendable per chain: Stellar reserve-aware from Horizon; ETH minus a gas
  // reserve; SOL/BTC from a live read (integer-exact MAX, web 2026-08-26).
  React.useEffect(() => {
    let cancelled = false;
    setSpendable(null);
    if (!from) return;
    const compute = async (): Promise<number> => {
      if (isStellar) {
        const s = await loadSource(from);
        return symbol === "XLM" ? spendableXlmForOutflow(s.xlmBalance, s.subentryCount, hasActiveSavings) : s.usdcBalance ?? 0;
      }
      if (symbol === "ETH") return spendableEth(balance);
      if (symbol === "SOL") return Number((await solMaxSend(from)) ?? 0);
      return Number((await btcMaxSend(from)) ?? 0);
    };
    compute()
      .then((v) => !cancelled && setSpendable(v))
      .catch(() => !cancelled && setSpendable(balance));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, symbol, hasActiveSavings, balance]);

  // Stellar memo-required lookup (three layers; lib/stellar/send.ts).
  React.useEffect(() => {
    let cancelled = false;
    if (!isStellar || !destOk) {
      setMemoReq(null);
      return;
    }
    fetchMemoRequirement(destTrim).then((r) => !cancelled && setMemoReq(r));
    return () => {
      cancelled = true;
    };
  }, [isStellar, destOk, destTrim]);

  const paste = async () => {
    const text = (await Clipboard.getStringAsync()).trim();
    if (text) setDestination(text);
  };

  const applyScan = (data: string): string | void => {
    if (isStellar) {
      const p = parseStellarQr(data);
      if ("error" in p) return p.error;
      setDestination(p.destination);
      if (p.memo !== undefined) setMemo(p.memo);
      if (p.assetCode === "XLM" || p.assetCode === "USDC") setSymbol(p.assetCode);
      if (p.amount) setAmount(p.amount);
    } else {
      const p = parseChainQr(data, symbol);
      if ("error" in p) return p.error;
      setDestination(p.destination);
      if (p.amount) setAmount(p.amount);
    }
    setScanning(false);
  };

  const useMax = () => {
    if (spendable === null) return;
    setAmount(trim(spendable, DECIMALS[symbol]));
    setUsdText(price ? (spendable * price).toFixed(2) : "");
  };

  const addChain = async () => {
    if (!user) return;
    setAddingChain(true);
    try {
      const updated = await provisionChain({ user, wallet, chain: meta.chain });
      queryClient.setQueryData(turnkeyWalletQueryKey(user?.id), updated);
      await refetchWallet();
    } catch (e) {
      if (!isUserCancelledError(e)) Alert.alert("Couldn’t add the chain", describeTurnkeyError(e));
    } finally {
      setAddingChain(false);
    }
  };

  // BTC: the confirm sheet shows the builder's real fee (same call, unsigned).
  const openConfirm = async () => {
    setVerified(false);
    setFeePreview(null);
    setConfirming(true);
    if (symbol === "BTC") {
      try {
        const b = await btcBuild(destTrim, Math.round(amountNum * 1e8));
        setFeePreview(`${(b.estimatedFeeSat / 1e8).toFixed(8).replace(/\.?0+$/, "")} BTC (${b.feeRateSatPerVbyte} sat/vB)`);
      } catch (e) {
        setFeePreview(e instanceof Error ? e.message : "fee unavailable");
      }
    }
  };

  // A null spendable means the live read hasn't answered — never let the
  // user proceed on a number we don't have (the gas-reserve gap Niko hit).
  const cannotCoverGas = symbol === "ETH" && balance > 0 && balance <= GAS_RESERVE_ETH;
  const canContinue = !!from && amountOk && destOk && !memoMissing && spendable !== null && amountNum <= spendable + EPS && !cannotCoverGas;

  const send = async () => {
    if (!wallet?.subOrgId || !from) return;
    setBusy(true);
    try {
      // Device gate: the first signature on this phone proves the passkey.
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

      let hash: string;
      if (isStellar) {
        const r = await sendStellar({
          subOrgId: wallet.subOrgId,
          from,
          symbol: symbol as "XLM" | "USDC",
          amount: amountNum,
          destination: destTrim,
          memo: memo.trim() || undefined,
          hasActiveSavings,
          onStep: setStep
        });
        hash = r.hash;
      } else if (symbol === "ETH") {
        hash = await sendEth({ subOrgId: wallet.subOrgId, from, to: destTrim, amount: amountNum, balance, onStep: setStep });
      } else if (symbol === "SOL") {
        hash = await sendSol({ subOrgId: wallet.subOrgId, from, to: destTrim, amount: amountNum, onStep: setStep });
      } else {
        hash = await sendBtc({ from, to: destTrim, amount: amountNum, onStep: setStep });
      }
      setResult({ hash });
      setConfirming(false);
      // Visible in Activity at once, until the chain feed carries the hash.
      addPendingSend({ chain: meta.chain, txHash: hash, symbol, amount: String(amountNum), destination: destTrim });
      void refreshAfterStellarAction(queryClient, {
        userId: user?.id,
        stellarAddress: wallet.stellarAddress,
        chain: meta.chain,
        chainAddress: from,
        expectMove: [symbol]
      });
    } catch (e) {
      if (isUserCancelledError(e)) Alert.alert("Cancelled", "Nothing was sent.");
      else Alert.alert("Send failed", e instanceof Error ? e.message : describeTurnkeyError(e));
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

  const feeText = symbol === "SOL" ? `${SOL_FEE} SOL` : isStellar ? `${STELLAR_TX_FEE_XLM} XLM` : meta.feeLabel;

  if (result) {
    return (
      <Screen>
        <YStack flex={1} paddingHorizontal={space.gutter} paddingTop={80} gap={20}>
          <Card padding={20} gap={12} alignItems='center'>
            <IconBox size={56}><Check size={28} color={c.positive} strokeWidth={2} /></IconBox>
            <UiText fontSize={16} fontWeight='500'>{symbol === "BTC" ? "Broadcast" : "Sent"}</UiText>
            <Mono fontSize={22} letterSpacing={tracking(22)}>{fAssetQuantity(amountNum, symbol)} {symbol}</Mono>
            <UiText fontSize={13} color={c.muted} textAlign='center'>to {shortenAddress(destTrim, 6, 6)}</UiText>
            {symbol === "BTC" ? (
              <UiText fontSize={12} color={c.muted} textAlign='center' lineHeight={17}>Bitcoin confirms in about 10–60 minutes. It shows as pending in Activity until then.</UiText>
            ) : null}
            <Mono fontSize={11} color={c.faint}>{shortenAddress(result.hash, 8, 8)}</Mono>
            <YStack width='100%' gap={8} marginTop={4}>
              <PrimaryButton label='Done' onPress={() => router.replace("/(tabs)")} />
              <SecondaryButton label='View on explorer' onPress={() => Linking.openURL(meta.explorerTx(result.hash))} />
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
              <IconButton onPress={() => router.back()} label='Back'><ChevronLeft size={22} color={c.ink} strokeWidth={2} /></IconButton>
              <UiText fontSize={22} fontWeight='600' letterSpacing={tracking(22)}>Send</UiText>
            </XStack>

            <Card padding={14} gap={12}>
              <XStack gap={6} flexWrap='wrap'>
                {SEND_ORDER.map((s) => {
                  const selected = s === symbol;
                  return (
                    <XStack
                      key={s}
                      onPress={() => { setSymbol(s); setAmount(""); setDestination(""); setMemo(""); }}
                      alignItems='center' gap={8} paddingVertical={6} paddingLeft={6} paddingRight={12}
                      borderRadius={radius.pill} borderWidth={1}
                      borderColor={selected ? c.ink : c.border} backgroundColor={selected ? c.ink : "transparent"}
                    >
                      <AssetIcon symbol={s} size={24} fontSize='$2' />
                      <UiText fontSize={13} fontWeight='600' color={selected ? c.ctaText : c.ink}>{s}</UiText>
                    </XStack>
                  );
                })}
              </XStack>

              {!from ? (
                <YStack gap={10} paddingTop={4}>
                  <UiText fontSize={13} color={c.muted} lineHeight={18}>
                    {wallet ? `Your Normal wallet has no ${meta.name} address yet. One passkey confirmation adds it on the same wallet.` : `You don’t have a Normal wallet yet. One passkey confirmation creates it with a ${meta.name} address.`}
                  </UiText>
                  <PrimaryButton label={addingChain ? "Adding…" : `Add ${meta.name}`} onPress={addChain} loading={addingChain} />
                </YStack>
              ) : (
                <>
                  <XStack alignItems='center' gap={10}>
                    {fiat ? <Mono fontSize={28} color={c.muted} letterSpacing={tracking(28)}>$</Mono> : null}
                    <Input {...inputStyle} flex={1} height={56} fontFamily='$mono' fontSize={28} letterSpacing={tracking(28)} placeholder='0.00' keyboardType='decimal-pad' value={fiat ? usdText : amount} onChangeText={onAmountText} editable={!busy} />
                    <PillButton label='Max' onPress={useMax} />
                  </XStack>
                  <XStack justifyContent='space-between' alignItems='center' gap={10}>
                    {price > 0 ? (
                      <CurrencyToggle
                        converted={amountOk ? `≈ ${fiat ? `${fAssetQuantity(amountNum, symbol)} ${symbol}` : fCurrency(amountNum * price)}` : fiat ? `0 ${symbol}` : fCurrency(0)}
                        switchTo={fiat ? symbol : "USD"}
                        onPress={toggleFiat}
                        muted={!amountOk}
                      />
                    ) : (
                      <UiText fontSize={12} color={c.muted}> </UiText>
                    )}
                    {/* What you own, in coins and in dollars (Niko 2026-10-08). */}
                    <YStack alignItems='flex-end' gap={1}>
                      <Mono fontSize={12} color={spendable !== null && amountNum > spendable + EPS ? c.failed : c.muted}>
                        {spendable === null ? "…" : `${fAssetQuantity(spendable, symbol)} ${symbol} available`}
                      </Mono>
                      {spendable !== null && price > 0 ? <Mono fontSize={11} color={c.faint}>≈ {fCurrency(spendable * price)}</Mono> : null}
                    </YStack>
                  </XStack>
                  {cannotCoverGas ? (
                    <UiText fontSize={12} color={c.failed}>
                      Not enough ETH to pay gas — sending needs about {GAS_RESERVE_ETH} ETH on top of the amount.
                    </UiText>
                  ) : spendable !== null && amountOk && amountNum > spendable + EPS ? (
                    <UiText fontSize={12} color={c.failed}>Amount exceeds what you can send after fees.</UiText>
                  ) : null}
                </>
              )}
            </Card>

            {from ? (
              <Card padding={14} gap={12}>
                <UiText fontSize={12} color={c.muted}>To ({meta.name} address)</UiText>
                <XStack alignItems='center' gap={8}>
                  <Input {...inputStyle} flex={1} height={48} paddingHorizontal={12} fontFamily='$mono' fontSize={12} placeholder={meta.placeholder} autoCapitalize={isStellar ? "characters" : "none"} autoCorrect={false} value={destination} onChangeText={setDestination} editable={!busy} />
                  <IconButton onPress={() => setScanning(true)} label='Scan QR code'><ScanLine size={20} color={c.muted} strokeWidth={1.8} /></IconButton>
                  <IconButton onPress={paste} label='Paste'><ClipboardPaste size={20} color={c.muted} strokeWidth={1.8} /></IconButton>
                </XStack>
                {destination.trim() && !destOk ? (
                  <UiText fontSize={12} color={c.failed}>{destTrim === from ? "That’s your own address." : `Not a valid ${meta.name} address.`}</UiText>
                ) : null}

                {isStellar ? (
                  <>
                    {memoReq?.required ? (
                      <XStack gap={8} padding={12} borderRadius={radius.input} backgroundColor={c.chips.amber.bg}>
                        <TriangleAlert size={16} color={c.chips.amber.color} strokeWidth={2} />
                        <UiText fontSize={13} color={c.chips.amber.color} flex={1} lineHeight={18}>
                          {memoReq.name ?? "This exchange"} requires a deposit memo. Without it your {symbol} will arrive but never be credited to you.
                        </UiText>
                      </XStack>
                    ) : memoReq?.unknown ? (
                      <UiText fontSize={12} color={c.muted}>Couldn’t check whether this address needs a memo. If it’s an exchange, add the memo it gave you.</UiText>
                    ) : null}
                    <UiText fontSize={12} color={c.muted}>Memo {memoReq?.required ? "(required)" : "(optional)"}</UiText>
                    <Input {...inputStyle} height={44} paddingHorizontal={12} fontFamily='$mono' fontSize={13} placeholder='Exchange deposit memo, if any' autoCapitalize='none' autoCorrect={false} maxLength={28} value={memo} onChangeText={setMemo} editable={!busy} />
                  </>
                ) : symbol === "ETH" ? (
                  <UiText fontSize={12} color={c.muted} lineHeight={17}>Exchange deposits: use the exchange’s ETH deposit address, not a contract address. Gas is estimated for this exact destination before you sign.</UiText>
                ) : null}
              </Card>
            ) : null}

            {from ? (
              <>
                <XStack justifyContent='space-between' paddingHorizontal={4}>
                  <UiText fontSize={13} color={c.muted}>Network fee</UiText>
                  <Mono fontSize={13} color={c.muted}>{feeText}</Mono>
                </XStack>
                <PrimaryButton label='Continue' onPress={openConfirm} disabled={!canContinue} />
              </>
            ) : null}
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>

      <QrScanner open={scanning} onClose={() => setScanning(false)} onScan={applyScan} />

      <Modal visible={confirming} transparent animationType='slide' onRequestClose={() => !busy && setConfirming(false)}>
        <YStack flex={1} justifyContent='flex-end' backgroundColor='rgba(10,10,15,0.45)'>
          <YStack backgroundColor={c.surface} borderTopLeftRadius={radius.dialog} borderTopRightRadius={radius.dialog} padding={space.gutter} paddingBottom={32} gap={14}>
            <XStack justifyContent='space-between' alignItems='center'>
              <UiText fontSize={16} fontWeight='600'>Confirm send</UiText>
              <IconButton onPress={() => !busy && setConfirming(false)} label='Close'><X size={20} color={c.muted} strokeWidth={2} /></IconButton>
            </XStack>
            <YStack alignItems='center' gap={4} paddingVertical={8}>
              <Mono fontSize={32} letterSpacing={tracking(32)}>{fAssetQuantity(amountNum, symbol)} {symbol}</Mono>
              {price ? <UiText fontSize={13} color={c.muted}>{fCurrency(amountNum * price)}</UiText> : null}
            </YStack>
            <Card paddingTop={4} paddingHorizontal={4} paddingBottom={4}>
              <XStack paddingHorizontal={space.rowX} paddingVertical={space.rowY} justifyContent='space-between'>
                <UiText fontSize={13.5} color={c.muted}>To</UiText>
                <Mono fontSize={12}>{shortenAddress(destTrim, 8, 8)}</Mono>
              </XStack>
              {isStellar && memo.trim() ? (
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
                <Mono fontSize={12}>{symbol === "BTC" ? feePreview ?? "estimating…" : feeText}</Mono>
              </XStack>
            </Card>
            <XStack onPress={() => !busy && setVerified((v) => !v)} alignItems='center' gap={10} paddingVertical={4} accessibilityRole='checkbox' accessibilityState={{ checked: verified }}>
              <YStack width={22} height={22} borderRadius={6} borderWidth={1.5} borderColor={verified ? c.ink : c.borderStrong} backgroundColor={verified ? c.ink : "transparent"} alignItems='center' justifyContent='center'>
                {verified ? <Check size={14} color={c.ctaText} strokeWidth={3} /> : null}
              </YStack>
              <UiText fontSize={13} flex={1} lineHeight={18}>I have verified the address and amount.</UiText>
            </XStack>
            <UiText fontSize={12} color={c.faint} textAlign='center'>
              {meta.name} transfers are final and can’t be reversed.
            </UiText>
            <PrimaryButton label={step ? STEP_LABEL[step] : "Send with passkey"} onPress={send} loading={busy} disabled={!verified || (symbol === "BTC" && !feePreview)} />
          </YStack>
        </YStack>
      </Modal>
    </Screen>
  );
}
