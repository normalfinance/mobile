// Cross-chain transfers that outlive the screen — the mobile version of web's
// cctp-resume-banner. Reads GET cctp/transfers (in-flight rows), classifies
// each with the verbatim phase table, "pokes" auto rows (a plain GET advances
// the state machine between cron ticks) every 30s while on screen, and offers
// the one action a halted row needs: Finish (pivot) or Bring back as USDC.

import React from "react";
import { Alert } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { XStack, YStack } from "tamagui";
import { ArrowLeftRight } from "lucide-react-native";

import { Card, Chip, Mono, PillButton, UiText } from "@/components/home/primitives";
import { useTurnkeyWallet } from "@/hooks/use-turnkey-wallet";
import { apiFetch } from "@/lib/api";
import { bannerPhase, fetchCctpTransfers, recoverInbound, recoverOutbound, refundOutbound, type CctpTransfer } from "@/lib/cctp/engine";
import type { CrosschainSymbol } from "@/lib/cctp/config";
import { useColors } from "@/lib/theme/appearance";
import { space } from "@/lib/theme/tokens";
import { describeTurnkeyError, isUserCancelledError } from "@/lib/turnkey/client";

export const inFlightQueryKey = ["cctp", "in-flight"] as const;

const ADDRESS_OF: Record<CrosschainSymbol, "bitcoinAddress" | "ethereumAddress" | "solanaAddress"> = {
  BTC: "bitcoinAddress",
  ETH: "ethereumAddress",
  SOL: "solanaAddress"
};

const copyFor = (tr: CctpTransfer, phase: ReturnType<typeof bannerPhase>) => {
  if (phase === "halt-finish") return { title: `USDC arrived on Base — finish the swap to ${tr.dstAsset}`, sub: "One more confirmation with your passkey", tone: "amber" as const, chip: "Action needed" };
  if (phase === "halt-receive") return { title: `USDC heading to your own Base account — finish once it arrives`, sub: `From ${tr.srcAsset}; the Circle bridge to Stellar needs one confirmation (automatic with autopilot)`, tone: "amber" as const, chip: "Action needed" };
  if (phase === "auto") return { title: `Bridging USDC to Stellar`, sub: "Completes automatically — safe to close", tone: "blue" as const, chip: "In progress" };
  if (tr.burnTxHash && tr.status !== "COMPLETED") return { title: `Bridging USDC to Base`, sub: "Circle attestation — about a minute", tone: "blue" as const, chip: "In progress" };
  return { title: `Swap USDC → ${tr.dstAsset}`, sub: "Waiting for the first transaction", tone: "neutral" as const, chip: "Pending" };
};

export const InFlightTransfers = () => {
  const c = useColors();
  const isFocused = useIsFocused();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { wallet } = useTurnkeyWallet();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [stageText, setStageText] = React.useState<string | null>(null);

  const q = useQuery({
    queryKey: inFlightQueryKey,
    enabled: !!wallet && isFocused,
    // history=1 on purpose (web): the in-flight filter excludes COMPLETED, which
    // is exactly the "minted on Base, pivot pending" outbound case.
    queryFn: () => fetchCctpTransfers(true),
    staleTime: 20_000,
    refetchInterval: (query) => ((query.state.data ?? []).length > 0 && isFocused ? 30_000 : false)
  });
  const TERMINAL = ["FAILED", "REFUNDED"];
  const rows = (q.data ?? []).filter((tr) => {
    if (TERMINAL.includes(tr.status)) return false;
    const phase = bannerPhase(tr);
    if (phase !== "hidden") return true; // halt-finish / halt-receive / auto
    // Outbound mid-bridge (burn sent, mint pending): web's modal owns this; on a
    // phone the screen may be gone, so show it — the poke advances it.
    return tr.direction === "stellar_to_crosschain" && !!tr.burnTxHash && !tr.dstSwapTxHash && tr.status !== "COMPLETED";
  });

  // Poke: a plain GET of each auto/bridging row advances it server-side.
  React.useEffect(() => {
    if (!isFocused) return;
    rows
      .filter((tr) => bannerPhase(tr) === "auto" || (tr.burnTxHash && !tr.mintTxHash && tr.status !== "COMPLETED"))
      .forEach((tr) => void apiFetch(`/api/cctp/transfers/${tr.id}`).catch(() => undefined));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.dataUpdatedAt, isFocused]);

  if (!rows.length) return null;

  const finishInbound = async (tr: CctpTransfer) => {
    if (!wallet?.subOrgId) return;
    setBusyId(tr.id);
    try {
      const outcome = await recoverInbound({ subOrgId: wallet.subOrgId, row: tr, onStage: (s) => setStageText(s === "topup" ? "Covering network fees…" : "Starting the bridge…") });
      if (outcome === "burned") Alert.alert("Bridging to Stellar", "Your USDC is on its way — completes automatically in about 20 minutes.");
      else if (outcome === "retired") Alert.alert("Nothing was bridged", "That swap had already failed on-chain — your funds never left your wallet. Removed it from In flight.");
      else Alert.alert("Not there yet", "USDC has not reached Base yet — the bridge is still working. This finishes by itself; nothing to do.");
    } catch (e) {
      if (!isUserCancelledError(e)) Alert.alert("Couldn’t finish", e instanceof Error ? e.message : describeTurnkeyError(e));
    } finally {
      setBusyId(null);
      setStageText(null);
      void queryClient.invalidateQueries({ queryKey: inFlightQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
    }
  };

  const finish = async (tr: CctpTransfer) => {
    if (!wallet?.subOrgId) return;
    const toAddress = wallet[ADDRESS_OF[tr.dstAsset as CrosschainSymbol]];
    if (!toAddress) {
      Alert.alert("Set up first", `Add ${tr.dstAsset} to your wallet (Assets tab) to receive the funds, then finish.`);
      return;
    }
    setBusyId(tr.id);
    try {
      await recoverOutbound({ subOrgId: wallet.subOrgId, row: tr, toAddress, onStage: (s) => setStageText(s === "topup" ? "Covering network fees…" : s === "pivot-swap" ? "Swapping on Base…" : s === "delivering" ? `Delivering ${tr.dstAsset}…` : null) });
      Alert.alert("On its way", `${tr.dstAsset} is on its way to your wallet.`);
    } catch (e) {
      if (!isUserCancelledError(e)) Alert.alert("Couldn’t finish", e instanceof Error ? e.message : describeTurnkeyError(e));
    } finally {
      setBusyId(null);
      setStageText(null);
      void queryClient.invalidateQueries({ queryKey: inFlightQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
    }
  };

  const bringBack = (tr: CctpTransfer) => {
    Alert.alert("Bring back as USDC?", "Your USDC on Base will be bridged back to your Stellar wallet (about 20 minutes). One passkey confirmation.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Bring back",
        onPress: async () => {
          if (!wallet?.subOrgId) return;
          setBusyId(tr.id);
          try {
            await refundOutbound({ subOrgId: wallet.subOrgId, row: tr, onStage: (s) => setStageText(s === "topup" ? "Covering network fees…" : "Sending your USDC back…") });
            Alert.alert("Returning to Stellar", "Completes automatically in about 20 minutes — safe to close.");
          } catch (e) {
            if (!isUserCancelledError(e)) Alert.alert("Couldn’t start the refund", e instanceof Error ? e.message : describeTurnkeyError(e));
          } finally {
            setBusyId(null);
            setStageText(null);
            void queryClient.invalidateQueries({ queryKey: inFlightQueryKey });
          }
        }
      }
    ]);
  };

  return (
    <YStack gap={8}>
      <UiText fontSize={14} fontWeight='500' color={c.ink2}>In flight</UiText>
      <Card>
        {rows.map((tr, i) => {
          const phase = bannerPhase(tr);
          const copy = copyFor(tr, phase);
          const busy = busyId === tr.id;
          return (
            <YStack
              key={tr.id}
              padding={space.rowX}
              gap={8}
              borderTopWidth={i ? 1 : 0}
              borderTopColor={c.divider}
              onPress={() => router.push({ pathname: "/swap-run", params: { transferId: tr.id } })}
              pressStyle={{ backgroundColor: c.pressTint }}
              accessibilityRole='button'
            >
              <XStack alignItems='center' gap={space.rowGap}>
                <YStack width={32} height={32} borderRadius={16} backgroundColor={c.iconCircle} alignItems='center' justifyContent='center'>
                  <ArrowLeftRight size={16} color={c.ink} strokeWidth={2} />
                </YStack>
                <YStack flex={1} gap={2}>
                  <XStack alignItems='center' gap={6} flexWrap='wrap'>
                    <UiText fontSize={14} fontWeight='600'>{copy.title}</UiText>
                    <Chip tone={copy.tone} label={busy && stageText ? stageText : copy.chip} />
                  </XStack>
                  <UiText fontSize={12} color={c.muted}>{copy.sub}</UiText>
                  <Mono fontSize={11} color={c.faint}>{tr.srcAmount ?? "—"} USDC · {new Date(tr.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</Mono>
                </YStack>
              </XStack>
              {phase === "halt-finish" ? (
                <XStack gap={8}>
                  <PillButton label={busy ? "Working…" : "Finish"} onPress={() => !busy && void finish(tr)} />
                  <PillButton label='Bring back as USDC' onPress={() => !busy && bringBack(tr)} />
                </XStack>
              ) : phase === "halt-receive" ? (
                <XStack gap={8}>
                  <PillButton label={busy ? "Working…" : "Finish"} onPress={() => !busy && void finishInbound(tr)} />
                </XStack>
              ) : null}
            </YStack>
          );
        })}
      </Card>
    </YStack>
  );
};
