// The swap RUN page (web doc 93 0c, mobile single column): every step shown up
// front, an explicit "Start swap" button, live progress from the run store,
// and a resume view for a transfer reopened from In flight (steps derived
// from the server row's phase, with the one action it needs).

import React from "react";
import { Alert, Linking, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { XStack, YStack } from "tamagui";
import { Check, ChevronLeft } from "lucide-react-native";

import { AssetIcon } from "@/components/ui/AssetIcon";
import { Card, Divider, IconBox, IconButton, Mono, PillButton, PrimaryButton, Screen, SecondaryButton, UiText } from "@/components/home/primitives";
import { StepList } from "@/components/savings/StepList";
import { AutopilotSheet } from "@/components/swap/AutopilotSheet";
import { inFlightQueryKey } from "@/components/swap/InFlightTransfers";
import { useTurnkeyWallet } from "@/hooks/use-turnkey-wallet";
import { NATIVE_CHAIN, type CrosschainSymbol } from "@/lib/cctp/config";
import { bannerPhase, fetchCctpTransfer, quoteSnapshot, recoverInbound, recoverOutbound, refundOutbound, type CctpTransfer } from "@/lib/cctp/engine";
import { refreshAfterStellarAction } from "@/lib/data/after-action";
import { useRun, useRunByTransfer, updateRun } from "@/lib/swap/run-store";
import { startRun } from "@/lib/swap/runner";
import { activeStepFor, explorerFor, stepsFor, timingFor } from "@/lib/swap/steps";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";
import { autopilotAvailable, fetchAutopilotStatus, grantAutopilotConsent } from "@/lib/turnkey/autopilot";
import { describeTurnkeyError, isUserCancelledError } from "@/lib/turnkey/client";
import { ensureDeviceReady } from "@/lib/turnkey/device-check";
import { useDeviceReady } from "@/lib/turnkey/device-ready";
import { fNumber } from "@/lib/utils/number-format.utils";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

const ADDRESS_OF: Record<CrosschainSymbol, "bitcoinAddress" | "ethereumAddress" | "solanaAddress"> = { BTC: "bitcoinAddress", ETH: "ethereumAddress", SOL: "solanaAddress" };

/**
 * What a server row means for the step list. Statuses are the server's state
 * machine (web lib/cctp/state.ts): CREATED → BURN_SUBMITTED → ATTESTED →
 * MINT_SUBMITTED → COMPLETED, plus FAILED / REFUNDED. "Finished" is web's
 * definition: outbound once the pivot swap is on-chain, inbound once COMPLETED.
 */
const rowView = (tr: CctpTransfer) => {
  const outbound = tr.direction === "stellar_to_crosschain";
  const phase = bannerPhase(tr);
  const terminal = tr.status === "FAILED" || tr.status === "REFUNDED";
  const finished = outbound ? !!tr.dstSwapTxHash : tr.status === "COMPLETED";
  const stage: string | null = terminal
    ? null
    : finished
      ? "done"
      : outbound
        ? phase === "halt-finish" ? "pivot-swap" : tr.burnTxHash ? "bridging" : "burn-prepare"
        : tr.burnTxHash ? "bridging" : tr.srcSwapTxHash ? "arriving" : "lifi";
  return { outbound, phase, terminal, finished, stage };
};

export default function SwapRunScreen() {
  const c = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ runId?: string; transferId?: string }>();
  const { user } = useSupabaseAuth();
  const { wallet } = useTurnkeyWallet();
  const { ready: deviceReady } = useDeviceReady(wallet?.subOrgId);

  const runById = useRun(params.runId);
  const runByTransfer = useRunByTransfer(params.transferId);
  const run = runById ?? runByTransfer;

  // Resume mode: a server row without a live run in this session. Reads the
  // ONE row (a plain GET advances it server-side between cron ticks — web's
  // resume view does the same) at web's cadence: 5s while the Circle bridge is
  // mid-flight, 10s while waiting on an arrival or pivot, 15s otherwise, off
  // once finished or terminal.
  const rowQ = useQuery({
    queryKey: ["cctp", "row", params.transferId ?? "none"],
    enabled: !!params.transferId && !run,
    queryFn: () => fetchCctpTransfer(params.transferId!, true),
    refetchInterval: (query) => {
      const tr = query.state.data;
      if (!tr) return 15_000;
      const view = rowView(tr);
      if (view.finished || view.terminal) return false;
      if (view.stage === "bridging") return 5_000;
      if (view.phase === "halt-finish" || view.phase === "halt-receive" || view.stage === "delivering") return 10_000;
      return 15_000;
    }
  });
  const row = rowQ.data ?? null;

  // Hard rule 14: when the server says the row finished, refetch the
  // destination chain before the screen says "Done" — and never show the old
  // balance on Home behind it.
  const refreshedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!row || !user?.id || !wallet?.stellarAddress) return;
    if (!rowView(row).finished || refreshedRef.current === row.id) return;
    refreshedRef.current = row.id;
    const outbound = row.direction === "stellar_to_crosschain";
    const to = row.dstAsset as CrosschainSymbol;
    void refreshAfterStellarAction(queryClient, {
      userId: user.id,
      stellarAddress: wallet.stellarAddress,
      ...(outbound && NATIVE_CHAIN[to] ? { chain: NATIVE_CHAIN[to], chainAddress: wallet[ADDRESS_OF[to]] ?? undefined, expectMove: [to] } : { expectMove: ["USDC"] })
    }).catch(() => undefined);
    void queryClient.invalidateQueries({ queryKey: inFlightQueryKey });
  }, [row, user?.id, wallet, queryClient]);

  // Autopilot consent (CCTP runs): once before Start; sticky for the run.
  const autopilotQ = useQuery({ queryKey: ["autopilot", "status"], queryFn: fetchAutopilotStatus, enabled: autopilotAvailable() && !!wallet, staleTime: 60_000 });
  const grantedRef = React.useRef(false);
  const [consentOpen, setConsentOpen] = React.useState(false);
  const [consentBusy, setConsentBusy] = React.useState(false);
  const resolver = React.useRef<((v: boolean) => void) | null>(null);
  const autopilotOn = grantedRef.current || autopilotQ.data?.active === true;
  const offerConsent = async (): Promise<boolean> => {
    if (!autopilotAvailable() || autopilotOn) return autopilotOn;
    if ((await AsyncStorage.getItem("autopilot_declined_v1").catch(() => null)) != null) return false;
    return new Promise((resolve) => {
      resolver.current = resolve;
      setConsentOpen(true);
    });
  };
  const enableAutopilot = async () => {
    if (!wallet?.subOrgId) return;
    setConsentBusy(true);
    try {
      await grantAutopilotConsent(wallet.subOrgId);
      grantedRef.current = true;
      if (run) updateRun(run.id, { flags: { autopilot: true } });
      void queryClient.invalidateQueries({ queryKey: ["autopilot", "status"] });
      setConsentOpen(false);
      resolver.current?.(true);
    } catch (e) {
      if (!isUserCancelledError(e)) Alert.alert("Couldn’t enable", e instanceof Error ? e.message : describeTurnkeyError(e));
    } finally {
      setConsentBusy(false);
    }
  };
  const declineAutopilot = () => {
    void AsyncStorage.setItem("autopilot_declined_v1", String(Date.now())).catch(() => undefined);
    setConsentOpen(false);
    resolver.current?.(false);
  };

  const start = async () => {
    if (!run || !wallet?.subOrgId || !wallet.stellarAddress) return;
    const gate = await ensureDeviceReady(wallet.subOrgId, wallet.stellarAddress, deviceReady);
    if (gate.outcome === "needs-setup") {
      router.push("/setup-device");
      return;
    }
    if (gate.outcome === "cancelled") return;
    if (gate.outcome === "failed") {
      Alert.alert("Couldn’t verify this phone", describeTurnkeyError(gate.error));
      return;
    }
    if (run.spec.kind !== "soroswap") await offerConsent();
    void Haptics.selectionAsync().catch(() => undefined);
    void startRun(run.id, { queryClient, userId: user?.id, wallet, autopilotHint: () => grantedRef.current || autopilotQ.data?.active === true });
  };

  // Haptic tick per stage change.
  const lastStage = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (run?.stage && run.stage !== lastStage.current) {
      lastStage.current = run.stage;
      void Haptics.selectionAsync().catch(() => undefined);
    }
  }, [run?.stage]);

  // ---- resume actions (server row) ------------------------------------------
  const [busyAction, setBusyAction] = React.useState<string | null>(null);
  const finishRow = async (tr: CctpTransfer) => {
    if (!wallet?.subOrgId) return;
    setBusyAction("finish");
    try {
      if (tr.direction === "stellar_to_crosschain") {
        const toAddress = wallet[ADDRESS_OF[tr.dstAsset as CrosschainSymbol]];
        if (!toAddress) throw new Error(`Add ${tr.dstAsset} to your wallet (Assets tab) first.`);
        await recoverOutbound({ subOrgId: wallet.subOrgId, row: tr, toAddress });
        Alert.alert("On its way", `${tr.dstAsset} is on its way to your wallet.`);
      } else {
        const o = await recoverInbound({ subOrgId: wallet.subOrgId, row: tr });
        Alert.alert(o === "burned" ? "Bridging to Stellar" : o === "retired" ? "Nothing was bridged" : "Not there yet", o === "burned" ? "Completes automatically in about 20 minutes." : o === "retired" ? "That swap had already failed on-chain — your funds never left your wallet." : "USDC has not reached Base yet — this finishes by itself.");
      }
    } catch (e) {
      if (!isUserCancelledError(e)) Alert.alert("Couldn’t finish", e instanceof Error ? e.message : describeTurnkeyError(e));
    } finally {
      setBusyAction(null);
      void queryClient.invalidateQueries({ queryKey: inFlightQueryKey });
      void rowQ.refetch();
    }
  };
  const bringBack = (tr: CctpTransfer) =>
    Alert.alert("Bring back as USDC?", "Your USDC on Base will be bridged back to your Stellar wallet (about 20 minutes).", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Bring back",
        onPress: async () => {
          if (!wallet?.subOrgId) return;
          setBusyAction("refund");
          try {
            await refundOutbound({ subOrgId: wallet.subOrgId, row: tr });
            Alert.alert("Returning to Stellar", "Completes automatically in about 20 minutes — safe to close.");
          } catch (e) {
            if (!isUserCancelledError(e)) Alert.alert("Couldn’t start the refund", e instanceof Error ? e.message : describeTurnkeyError(e));
          } finally {
            setBusyAction(null);
            void queryClient.invalidateQueries({ queryKey: inFlightQueryKey });
          }
        }
      }
    ]);

  // Title is the pair; amounts live in the card as two stacked rows — one
  // asset per row, real asset icons, no arrows (Niko 2026-09-16).
  const header = (from: string, to: string, pay: string, receive: string | null) => (
    <YStack gap={12}>
      <XStack alignItems='center' gap={4}>
        <IconButton onPress={() => router.back()} label='Back'><ChevronLeft size={22} color={c.ink} strokeWidth={2} /></IconButton>
        <UiText fontSize={22} fontWeight='600' letterSpacing={tracking(22)}>Swap {from} to {to}</UiText>
      </XStack>
      <Card paddingVertical={4} paddingHorizontal={4}>
        <XStack alignItems='center' gap={12} paddingHorizontal={space.rowX} paddingVertical={space.rowY}>
          <AssetIcon symbol={from} size={36} fontSize='$3' />
          <YStack flex={1}>
            <UiText fontSize={12} color={c.muted}>You pay</UiText>
            <Mono fontSize={16}>{pay} {from}</Mono>
          </YStack>
        </XStack>
        <Divider />
        <XStack alignItems='center' gap={12} paddingHorizontal={space.rowX} paddingVertical={space.rowY}>
          <AssetIcon symbol={to} size={36} fontSize='$3' />
          <YStack flex={1}>
            <UiText fontSize={12} color={c.muted}>You receive{receive?.startsWith("≥") ? " (minimum)" : ""}</UiText>
            {receive ? <Mono fontSize={16}>{receive.replace(/^[≥≈]\s*/, "")} {to}</Mono> : <UiText fontSize={14} color={c.muted}>{to} · amount shown on delivery</UiText>}
          </YStack>
        </XStack>
      </Card>
    </YStack>
  );

  // ---- render: live run ------------------------------------------------------
  if (run) {
    const { spec } = run;
    const steps = stepsFor(spec, run.flags, run.stage);
    const active = activeStepFor(spec, run.stage);
    const done = run.status === "done";
    const receiveText = spec.kind === "soroswap" ? `≈ ${fNumber(parseFloat(spec.quote.amountOut), { maximumFractionDigits: 4 })}` : spec.kind === "cctp-out" ? `≥ ${fNumber(spec.toAmount, { maximumFractionDigits: 6 })}` : `≥ ${fNumber(spec.usdcOut, { maximumFractionDigits: 2 })}`;
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
          <YStack paddingHorizontal={space.gutter} paddingTop={56} gap={20}>
            {header(spec.from, spec.to, spec.amount, receiveText)}

            {done ? (
              <YStack alignItems='center' gap={10} paddingTop={8}>
                <IconBox size={56}><Check size={28} color={c.positive} strokeWidth={2} /></IconBox>
                <UiText fontSize={16} fontWeight='500'>{spec.kind === "cctp-out" && run.result?.verdict !== "DONE" ? `${spec.to} is on its way` : "Swapped"}</UiText>
              </YStack>
            ) : null}

            <Card padding={14} gap={12}>
              <StepList title={done ? "Swap complete" : "What happens when you swap"} timing={done ? "" : timingFor(spec)} steps={done ? [...steps, { id: "done", label: "Done", sub: `${spec.to} received` }] : steps} activeId={active} allDone={done} />
              {!done ? (
                <UiText fontSize={12} color={c.muted} lineHeight={17}>
                  {spec.kind === "soroswap"
                    ? "Runs on Stellar via Soroswap. Nothing is sent until every confirmation is done — cancelling a prompt charges nothing."
                    : run.flags.autopilot || autopilotOn
                      ? "One signing step — everything after the bridge completes automatically, even if you close the app."
                      : "Two signing steps: one now, one after the bridge — stay in the app until then, or enable automatic completion."}
                </UiText>
              ) : null}
            </Card>

            {run.notice ? (
              <Card padding={14} gap={8} backgroundColor={run.notice.tone === "amber" ? c.chips.amber.bg : c.chips.blue.bg} borderColor='transparent'>
                <UiText fontSize={13} color={run.notice.tone === "amber" ? c.chips.amber.color : c.ink2} lineHeight={19}>{run.notice.text}</UiText>
                {run.notice.affordable ? <PillButton label={`Use ${run.notice.affordable} ${spec.from}`} onPress={() => router.back()} /> : null}
              </Card>
            ) : null}

            {run.status === "running" && spec.kind !== "soroswap" && !autopilotOn && autopilotAvailable() && autopilotQ.data?.active === false && run.stage && ["burn-prepare", "burn", "bridging", "topup", "lifi", "arriving"].includes(run.stage) ? (
              <Card padding={14} gap={10} backgroundColor={c.chips.blue.bg} borderColor='transparent'>
                <UiText fontSize={13} color={c.ink2} lineHeight={19}>Don’t want to wait around for the next confirmation? Enable automatic completion and this swap finishes by itself.</UiText>
                <PrimaryButton label={consentBusy ? "Confirming…" : "Enable auto-finish"} onPress={() => void enableAutopilot()} loading={consentBusy} />
              </Card>
            ) : null}

            <YStack gap={8}>
              {run.status === "idle" ? <PrimaryButton label='Start swap' onPress={() => void start()} /> : null}
              {run.status === "running" ? <PrimaryButton label={(steps.find((s) => s.id === active)?.label ?? "Working") + "…"} loading /> : null}
              {done && run.result ? (
                <>
                  <PrimaryButton label='Done' onPress={() => router.back()} />
                  <SecondaryButton label='View on explorer' onPress={() => Linking.openURL(explorerFor(spec, run.result!.hash))} />
                </>
              ) : null}
              {run.status === "error" || run.status === "calm" ? <PrimaryButton label={run.broadcastStarted ? "Back to Swap" : "Back"} onPress={() => router.back()} /> : null}
              {run.status === "running" && spec.kind !== "soroswap" && run.broadcastStarted ? (
                <UiText fontSize={12} color={c.faint} textAlign='center'>This step runs on our servers — you can safely leave this screen.</UiText>
              ) : null}
            </YStack>
          </YStack>
        </ScrollView>
        <AutopilotSheet open={consentOpen} busy={consentBusy} onEnable={() => void enableAutopilot()} onNotNow={declineAutopilot} />
      </Screen>
    );
  }

  // ---- render: resume from a server row ----------------------------------------
  if (row) {
    const { outbound, phase, terminal, finished, stage } = rowView(row);
    const expected = parseFloat(quoteSnapshot(row).expectedOut ?? "") || 0;
    const spec = outbound
      ? ({ kind: "cctp-out", from: "USDC", to: row.dstAsset as CrosschainSymbol, amount: row.srcAmount ?? "", feePercent: 0, lifiTool: null, toAddress: "", etaMin: null, toAmount: expected } as const)
      : ({ kind: "cctp-in", from: row.srcAsset as CrosschainSymbol, to: "USDC", amount: row.srcAmount ?? "", quote: { action: { fromChainId: 0, toChainId: 0, fromAmount: "0" }, estimate: { toAmount: "0", toAmountMin: row.amountWire, executionDuration: 0 }, transactionRequest: { data: "" } }, feePercent: 0, etaMin: null, usdcOut: Number(row.amountWire) / 1e6 } as const);
    const steps = stepsFor(spec, { autopilot: autopilotOn }, stage);
    // Delivered amount once the server has it; the quoted minimum before that.
    const delivered = parseFloat(row.dstAmount ?? "") || 0;
    const receiveText = outbound
      ? delivered ? fNumber(delivered, { maximumFractionDigits: 6 }) : expected ? `≥ ${fNumber(expected, { maximumFractionDigits: 6 })}` : null
      : finished && delivered ? fNumber(delivered, { maximumFractionDigits: 2 }) : `≥ ${fNumber(spec.usdcOut, { maximumFractionDigits: 2 })}`;
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
          <YStack paddingHorizontal={space.gutter} paddingTop={56} gap={20}>
            {header(spec.from, spec.to, spec.amount || "—", receiveText)}
            <Card padding={14} gap={12}>
              <StepList title={finished ? "Swap complete" : terminal ? (row.status === "REFUNDED" ? "Refunded" : "Did not complete") : "Swap in progress"} timing='' steps={finished ? [...steps, { id: "done", label: "Done", sub: `${spec.to} received` }] : steps} activeId={finished || terminal ? null : stage} allDone={finished} />
              {row.errorDetail ? <UiText fontSize={12} color={c.muted} lineHeight={17}>{row.errorDetail}</UiText> : null}
              {!finished && !terminal ? (
                <UiText fontSize={12} color={c.muted} lineHeight={17}>
                  {phase === "halt-finish"
                    ? "Your USDC is safe in your own Base account — finish the swap with one more confirmation, or bring it back as USDC."
                    : phase === "halt-receive"
                      ? "USDC heading to your own Base account — finish once it arrives (automatic with autopilot)."
                      : "This step runs on our servers — it completes by itself; you can close the app."}
                </UiText>
              ) : null}
            </Card>
            <YStack gap={8}>
              {phase === "halt-finish" ? (
                <>
                  <PrimaryButton label={busyAction === "finish" ? "Working…" : "Finish"} onPress={() => void finishRow(row)} loading={busyAction === "finish"} />
                  <SecondaryButton label='Bring back as USDC' onPress={() => bringBack(row)} disabled={!!busyAction} />
                </>
              ) : phase === "halt-receive" ? (
                <PrimaryButton label={busyAction === "finish" ? "Working…" : "Finish"} onPress={() => void finishRow(row)} loading={busyAction === "finish"} />
              ) : (
                <PrimaryButton label='Back' onPress={() => router.back()} />
              )}
              {row.burnTxHash && !outbound ? <SecondaryButton label='View on explorer' onPress={() => Linking.openURL(`https://basescan.org/tx/${row.burnTxHash}`)} /> : null}
            </YStack>
          </YStack>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <YStack flex={1} alignItems='center' justifyContent='center' padding={space.gutter} gap={12}>
        <UiText fontSize={14} color={c.muted}>{rowQ.isLoading ? "Loading…" : "This swap is no longer available."}</UiText>
        <PillButton label='Back' onPress={() => router.back()} />
      </YStack>
    </Screen>
  );
}
