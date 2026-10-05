// Transaction detail — web's row tap (swap-detail-modal for CCTP legs with
// "Finish this transfer", btc-tx-status-modal for Bitcoin confirmations, and
// the explorer link for everything else) as one screen. Opened from any
// Activity row with the row's fields as params (lib/activity/tx-params.ts).

import React from "react";
import { Alert, Linking, ScrollView } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { XStack, YStack } from "tamagui";
import { Check, ChevronLeft, Copy, ExternalLink } from "lucide-react-native";

import { AssetIcon } from "@/components/ui/AssetIcon";
import { Card, Chip, Divider, IconButton, Mono, PrimaryButton, Screen, SecondaryButton, UiText } from "@/components/home/primitives";
import { StepList, type Step } from "@/components/savings/StepList";
import { explorerUrl, type TxParams } from "@/lib/activity/tx-params";
import { bannerPhase, fetchCctpTransfer, type CctpTransfer } from "@/lib/cctp/engine";
import { useColors } from "@/lib/theme/appearance";
import { useMgiTransactions } from "@/hooks/use-mgi";
import { useTurnkeyWallet } from "@/hooks/use-turnkey-wallet";
import { FAILED_MGI_STATUSES, PENDING_MGI_STATUSES, mgiStatusLabel, openMgiDetails, refreshMgiStatus } from "@/lib/ramp/moneygram";
import { space, tracking } from "@/lib/theme/tokens";
import { fCurrency, fNumber } from "@/lib/utils/number-format.utils";

const LABEL: Record<string, string> = { receive: "Received", send: "Sent", swap: "Swapped", buy: "Bought", sell: "Sold", savings_deposit: "Saved", savings_withdraw: "Withdrew" };
const CHAIN_NAME: Record<string, string> = { stellar: "Stellar", bitcoin: "Bitcoin", ethereum: "Ethereum", solana: "Solana", base: "Base" };
const shorten = (h: string) => (h.length > 20 ? `${h.slice(0, 10)}…${h.slice(-8)}` : h);

/** Bitcoin: mempool.space tx status, polled every 30 s until confirmed (web btc-tx-status-modal). */
const useBtcStatus = (txid: string | null) =>
  useQuery({
    queryKey: ["btc-tx", txid ?? "none"],
    enabled: !!txid,
    queryFn: async () => {
      const r = await fetch(`https://mempool.space/api/tx/${txid}`);
      if (!r.ok) throw new Error(`mempool ${r.status}`);
      const j = (await r.json()) as { status?: { confirmed?: boolean; block_height?: number }; fee?: number };
      return { confirmed: !!j.status?.confirmed, block: j.status?.block_height ?? null, feeSat: j.fee ?? null };
    },
    refetchInterval: (q) => (q.state.data?.confirmed ? false : 30_000),
    retry: 1
  });

/** CCTP: the four legs from the server row, re-read every 8 s until terminal (web swap-detail-modal). */
const cctpLegs = (tr: CctpTransfer): { steps: Step[]; active: string | null; done: boolean; failed: boolean; refunded: boolean } => {
  const outbound = tr.direction === "stellar_to_crosschain";
  const terminal = tr.status === "FAILED" || tr.status === "REFUNDED";
  const finished = outbound ? !!tr.dstSwapTxHash : tr.status === "COMPLETED";
  const steps: Step[] = outbound
    ? [
        { id: "burn", label: "Burn on Stellar", sub: tr.burnTxHash ? "Sent" : "Waiting" },
        { id: "attest", label: "Circle attestation", sub: tr.status === "ATTESTED" || tr.status === "MINT_SUBMITTED" || tr.status === "COMPLETED" || tr.mintTxHash ? "Attested" : "Awaiting Circle" },
        { id: "mint", label: "Receive USDC on Base", sub: tr.mintTxHash || tr.status === "COMPLETED" ? "Minted" : "Waiting" },
        { id: "pivot", label: `Swap USDC → ${tr.dstAsset}`, sub: tr.dstSwapTxHash ? "Via LI.FI" : bannerPhase(tr) === "halt-finish" ? "Action needed" : "Waiting" }
      ]
    : [
        { id: "src", label: `Swap ${tr.srcAsset} → USDC`, sub: tr.srcSwapTxHash ? "Via LI.FI" : "Waiting" },
        { id: "burn", label: "Burn on Base", sub: tr.burnTxHash ? "Sent" : bannerPhase(tr) === "halt-receive" ? "Action needed" : "Waiting" },
        { id: "attest", label: "Circle attestation", sub: tr.status === "ATTESTED" || tr.status === "MINT_SUBMITTED" || tr.status === "COMPLETED" ? "Attested" : "Awaiting Circle (~20 min)" },
        { id: "mint", label: "Receive USDC on Stellar", sub: tr.status === "COMPLETED" ? "Delivered" : "Waiting" }
      ];
  const active = terminal || finished ? null : outbound
    ? !tr.burnTxHash ? "burn" : !tr.mintTxHash && tr.status !== "COMPLETED" ? "attest" : !tr.dstSwapTxHash ? "pivot" : null
    : !tr.srcSwapTxHash ? "src" : !tr.burnTxHash ? "burn" : tr.status !== "COMPLETED" ? "attest" : null;
  return { steps, active, done: finished, failed: tr.status === "FAILED", refunded: tr.status === "REFUNDED" };
};

export default function TxDetailScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = useLocalSearchParams<TxParams>();
  const [copied, setCopied] = React.useState(false);

  const amount = parseFloat(p.amount ?? "0") || 0;
  const usd = parseFloat(p.usdValue ?? "0") || 0;
  const when = new Date(Number(p.timestamp ?? Date.now()));
  const transferId = p.id?.startsWith("cctp:") ? p.id.slice(5) : null;
  const mgiId = p.id?.startsWith("mgi:") ? p.id.slice(4) : null;
  const mgiQ = useMgiTransactions(!!mgiId);
  const mgi = mgiId ? (mgiQ.data ?? []).find((t) => t.id === mgiId) ?? null : null;
  const { wallet } = useTurnkeyWallet();
  const [mgiBusy, setMgiBusy] = React.useState<null | "refresh" | "open">(null);
  const mgiAction = async (kind: "refresh" | "open") => {
    if (!mgiId || !wallet?.subOrgId || !wallet.stellarAddress) return;
    setMgiBusy(kind);
    try {
      if (kind === "refresh") {
        await refreshMgiStatus(wallet.stellarAddress, wallet.subOrgId, mgiId);
        await mgiQ.refetch();
      } else await openMgiDetails(wallet.stellarAddress, wallet.subOrgId, mgiId);
    } catch (e) {
      Alert.alert(kind === "refresh" ? "Couldn’t refresh" : "Couldn’t open MoneyGram", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setMgiBusy(null);
    }
  };
  const isBtcChain = p.chain === "bitcoin" && !!p.txHash;

  const cctpQ = useQuery({
    queryKey: ["cctp", "row", transferId ?? "none"],
    enabled: !!transferId,
    queryFn: () => fetchCctpTransfer(transferId!, false),
    refetchInterval: (q) => {
      const tr = q.state.data;
      if (!tr) return false;
      const legs = cctpLegs(tr);
      return legs.done || legs.failed || legs.refunded ? false : 8_000;
    }
  });
  const btc = useBtcStatus(isBtcChain ? p.txHash! : null);

  const status: "completed" | "pending" | "failed" = p.status === "failed" ? "failed" : p.status === "pending" ? "pending" : "completed";
  const liveStatus = isBtcChain && btc.data ? (btc.data.confirmed ? "completed" : "pending") : status;
  const explorer = p.txHash ? explorerUrl(p.chain, p.txHash) : null;
  const copy = async () => {
    if (!p.txHash) return;
    await Clipboard.setStringAsync(p.txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const legs = cctpQ.data ? cctpLegs(cctpQ.data) : null;
  const phase = cctpQ.data ? bannerPhase(cctpQ.data) : "hidden";

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <YStack paddingHorizontal={space.gutter} paddingTop={insets.top + 8} gap={20}>
          <XStack alignItems='center' gap={4} marginLeft={-10}>
            <IconButton onPress={() => router.back()} label='Back'><ChevronLeft size={22} color={c.ink} strokeWidth={2} /></IconButton>
            <UiText fontSize={22} fontWeight='600' letterSpacing={tracking(22)}>{mgiId ? (p.type === "sell" ? "MoneyGram cash-out" : "MoneyGram cash deposit") : LABEL[p.type ?? ""] ?? "Transaction"}</UiText>
          </XStack>

          <Card padding={16} gap={12}>
            <XStack alignItems='center' gap={12}>
              <AssetIcon symbol={p.asset ?? ""} size={40} fontSize='$3' />
              <YStack flex={1}>
                <Mono fontSize={22} letterSpacing={tracking(22)}>{fNumber(amount, { maximumFractionDigits: 8 })} {p.asset}</Mono>
                {usd > 0 ? <Mono fontSize={13} color={c.muted}>≈ {fCurrency(usd)}</Mono> : null}
              </YStack>
              <Chip tone={liveStatus === "completed" ? "green" : liveStatus === "failed" ? "amber" : "blue"} label={liveStatus === "completed" ? "Completed" : liveStatus === "failed" ? (p.counterparty?.includes("refunded") ? "Refunded" : "Failed") : phase === "halt-finish" || phase === "halt-receive" ? "Action needed" : "Pending"} />
            </XStack>
            <Divider inset={0} />
            <YStack gap={8}>
              <XStack justifyContent='space-between'><UiText fontSize={13} color={c.muted}>Date</UiText><Mono fontSize={13}>{when.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</Mono></XStack>
              {p.chain ? <XStack justifyContent='space-between'><UiText fontSize={13} color={c.muted}>Network</UiText><Mono fontSize={13}>{CHAIN_NAME[p.chain] ?? p.chain}</Mono></XStack> : null}
              {p.counterparty ? <XStack justifyContent='space-between' gap={12}><UiText fontSize={13} color={c.muted}>{p.type === "send" || p.type === "sell" ? "To" : p.type === "receive" ? "From" : "Details"}</UiText><Mono fontSize={13} flexShrink={1} textAlign='right'>{p.counterparty.length > 24 ? shorten(p.counterparty) : p.counterparty}</Mono></XStack> : null}
              {isBtcChain && btc.data ? (
                <>
                  <XStack justifyContent='space-between'><UiText fontSize={13} color={c.muted}>Confirmation</UiText><Mono fontSize={13}>{btc.data.confirmed ? `Block ${btc.data.block}` : "Confirming on Bitcoin network…"}</Mono></XStack>
                  {btc.data.feeSat !== null ? <XStack justifyContent='space-between'><UiText fontSize={13} color={c.muted}>Miner fee</UiText><Mono fontSize={13}>{fNumber(btc.data.feeSat / 1e8, { maximumFractionDigits: 8 })} BTC</Mono></XStack> : null}
                </>
              ) : null}
              {p.txHash ? (
                <XStack justifyContent='space-between' alignItems='center' gap={12} onPress={() => void copy()} pressStyle={{ opacity: 0.6 }}>
                  <UiText fontSize={13} color={c.muted}>{p.chain === "bitcoin" ? "Txid" : "Hash"}</UiText>
                  <XStack alignItems='center' gap={6}><Mono fontSize={12}>{shorten(p.txHash)}</Mono>{copied ? <Check size={14} color={c.positive} strokeWidth={2} /> : <Copy size={14} color={c.muted} strokeWidth={2} />}</XStack>
                </XStack>
              ) : null}
            </YStack>
            {isBtcChain && btc.data && !btc.data.confirmed ? <UiText fontSize={12} color={c.faint}>Bitcoin confirmations take ~10 minutes on average.</UiText> : null}
          </Card>

          {transferId ? (
            <Card padding={14} gap={12}>
              {legs ? (
                <>
                  <StepList
                    title={legs.done ? "Bridge complete" : legs.failed ? "Bridge did not complete" : legs.refunded ? "Bridge refunded" : "Bridge USDC (Circle CCTP)"}
                    timing=''
                    steps={legs.steps}
                    activeId={legs.active}
                    allDone={legs.done}
                    failedId={legs.failed ? legs.active ?? legs.steps[legs.steps.length - 1].id : null}
                    refundedId={legs.refunded ? (cctpQ.data?.direction === "stellar_to_crosschain" ? "pivot" : "src") : null}
                    refundedLabel='Refunded — USDC returned'
                  />
                  {cctpQ.data?.errorDetail ? <UiText fontSize={12} color={c.muted}>{cctpQ.data.errorDetail}</UiText> : null}
                  {phase === "halt-finish" || phase === "halt-receive" ? (
                    <PrimaryButton label='Finish this transfer' onPress={() => router.push({ pathname: "/swap-run", params: { transferId } })} />
                  ) : null}
                </>
              ) : (
                <UiText fontSize={13} color={c.muted}>{cctpQ.isLoading ? "Loading bridge status…" : "Bridge details unavailable."}</UiText>
              )}
            </Card>
          ) : null}

          {mgiId ? (
            <Card padding={14} gap={12}>
              {mgi ? (
                <>
                  <XStack justifyContent='space-between' alignItems='center'><UiText fontSize={13} color={c.muted}>MoneyGram status</UiText><Chip tone={mgi.status === "completed" ? "green" : FAILED_MGI_STATUSES.has(mgi.status) ? "amber" : "blue"} label={mgiStatusLabel(mgi.status)} /></XStack>
                  {mgi.externalTransactionId ? <XStack justifyContent='space-between'><UiText fontSize={13} color={c.muted}>Reference number</UiText><Mono fontSize={13} fontWeight='600'>{mgi.externalTransactionId}</Mono></XStack> : null}
                  <XStack justifyContent='space-between'><UiText fontSize={13} color={c.muted}>Updated</UiText><Mono fontSize={13}>{new Date(mgi.updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</Mono></XStack>
                  {mgi.kind === "deposit" && PENDING_MGI_STATUSES.has(mgi.status) ? <UiText fontSize={12} color={c.muted} lineHeight={17}>Drop off the cash at the MoneyGram location you selected — no code needed. Your USDC arrives shortly after paying.</UiText> : null}
                </>
              ) : (
                <UiText fontSize={13} color={c.muted}>{mgiQ.isLoading ? "Loading MoneyGram status…" : "MoneyGram details unavailable."}</UiText>
              )}
              <SecondaryButton label={mgiBusy === "refresh" ? "Refreshing…" : "Refresh status"} onPress={() => void mgiAction("refresh")} disabled={!!mgiBusy} />
              <PrimaryButton label={mgiBusy === "open" ? "Opening…" : "Open MoneyGram details"} onPress={() => void mgiAction("open")} disabled={!!mgiBusy} />
            </Card>
          ) : null}
          {explorer ? <SecondaryButton label='View on explorer' icon={<ExternalLink size={16} color={c.ink} strokeWidth={2} />} onPress={() => void Linking.openURL(explorer)} /> : null}
          {transferId && cctpQ.data?.burnTxHash && cctpQ.data.direction === "crosschain_to_stellar" ? (
            <SecondaryButton label='View burn on Base' icon={<ExternalLink size={16} color={c.ink} strokeWidth={2} />} onPress={() => void Linking.openURL(`https://basescan.org/tx/${cctpQ.data!.burnTxHash}`)} />
          ) : null}
        </YStack>
      </ScrollView>
    </Screen>
  );
}
