// Delete account (App Store guideline 5.1.1(v)), against the final web
// contract (lib/auth/delete-account.ts). Niko's rule: the recovery phrase of
// EVERY seed must be exported first — the server checks Turnkey's activity
// log, so the export runs here (one passkey per seed, phrase shown, "I saved
// it" tick). Flow: dry run → checklist → export where needed → dry run again
// → "I understand" + typed DELETE → delete → signed out.

import React from "react";
import { Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Input, XStack, YStack } from "tamagui";
import { Check, ChevronLeft, CircleAlert, CircleCheck, CircleDashed } from "lucide-react-native";

import { Card, IconButton, Mono, PrimaryButton, Screen, SecondaryButton, UiText } from "@/components/home/primitives";
import { useTurnkeyWallet } from "@/hooks/use-turnkey-wallet";
import { AccountDeleteBlockedError, checkAccountDeletion, deleteAccount, listWalletSeeds, type DeleteBlock } from "@/lib/auth/delete-account";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";
import { describeTurnkeyError, isUserCancelledError } from "@/lib/turnkey/client";
import { exportRecoveryPhrase } from "@/lib/turnkey/export";
import { markWalletBackedUp } from "@/lib/turnkey/provision";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";

type Gate = "pending" | "ok" | "blocked";

export default function DeleteAccountScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSupabaseAuth();
  const { wallet } = useTurnkeyWallet();

  const [checking, setChecking] = React.useState(true);
  const [block, setBlock] = React.useState<DeleteBlock | null>(null);
  const [override, setOverride] = React.useState(false);
  const [understood, setUnderstood] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // Export step state: the seed being revealed and its words.
  const [exporting, setExporting] = React.useState<{ walletId: string; label: string; words: string[]; saved: boolean } | null>(null);
  const [exportBusy, setExportBusy] = React.useState(false);

  const runCheck = React.useCallback(
    async (withOverride = override) => {
      setChecking(true);
      try {
        await checkAccountDeletion({ override: withOverride });
        setBlock(null);
      } catch (e) {
        if (e instanceof AccountDeleteBlockedError) setBlock(e.block);
        else Alert.alert("Couldn’t check your account", e instanceof Error ? e.message : "Please try again.");
      } finally {
        setChecking(false);
      }
    },
    [override]
  );
  React.useEffect(() => {
    void runCheck(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Export the next seed the server still wants (one passkey prompt).
  const exportNext = async () => {
    if (!wallet?.subOrgId || block?.code !== "EXPORT_REQUIRED") return;
    setExportBusy(true);
    try {
      const seeds = await listWalletSeeds();
      const next = block.wallets[0];
      if (!next) return;
      const words = await exportRecoveryPhrase(wallet.subOrgId, next);
      const label = seeds.find((s) => s.walletId === next)?.label ?? (seeds.length > 1 ? `Wallet ${block.wallets.length > 1 ? "" : ""}${next.slice(0, 6)}…` : "Your wallet");
      setExporting({ walletId: next, label, words, saved: false });
    } catch (e) {
      if (!isUserCancelledError(e)) Alert.alert("Couldn’t reveal the recovery phrase", describeTurnkeyError(e));
    } finally {
      setExportBusy(false);
    }
  };
  const finishExport = async () => {
    if (!exporting?.saved || !wallet?.subOrgId) return;
    await markWalletBackedUp(wallet.subOrgId);
    setExporting(null);
    await runCheck(); // the server re-reads Turnkey's log: this seed is now exported
  };

  const gate = (code: DeleteBlock["code"]): Gate => (checking ? "pending" : block === null ? "ok" : block.code === code ? "blocked" : "ok");
  const order: DeleteBlock["code"][] = ["EXPORT_REQUIRED", "IN_FLIGHT", "FUNDS_PRESENT"];
  const reached = (code: DeleteBlock["code"]) => block === null || order.indexOf(code) <= order.indexOf(block.code);
  const ready = block === null && !checking && understood && typed.trim().toUpperCase() === "DELETE" && !busy;

  const run = async () => {
    setBusy(true);
    try {
      await deleteAccount({ override });
      Alert.alert("Account deleted", "Your Normal account and its data are gone. Your crypto stays on-chain under the recovery phrase you saved.", [{ text: "OK", onPress: () => router.replace("/sign-in") }]);
    } catch (e) {
      if (e instanceof AccountDeleteBlockedError) setBlock(e.block);
      else Alert.alert("Couldn’t delete the account", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const GateRow = ({ code, label, detail }: { code: DeleteBlock["code"]; label: string; detail?: string }) => {
    const g = !reached(code) ? "pending" : gate(code);
    const Icon = g === "ok" ? CircleCheck : g === "blocked" ? CircleAlert : CircleDashed;
    const color = g === "ok" ? c.positive : g === "blocked" ? c.chips.amber.color : c.faint;
    return (
      <XStack alignItems='flex-start' gap={10}>
        <Icon size={18} color={color} strokeWidth={2} style={{ marginTop: 1 }} />
        <YStack flex={1} gap={2}>
          <UiText fontSize={14} fontWeight='500' color={g === "pending" ? c.muted : c.ink}>{label}</UiText>
          {detail ? <UiText fontSize={12.5} color={c.muted} lineHeight={17}>{detail}</UiText> : null}
        </YStack>
      </XStack>
    );
  };

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps='handled' contentContainerStyle={{ paddingBottom: 48 }}>
        <YStack paddingHorizontal={space.gutter} paddingTop={insets.top + 8} gap={16}>
          <XStack alignItems='center' gap={4} marginLeft={-10}>
            <IconButton onPress={() => router.back()} label='Back'><ChevronLeft size={22} color={c.ink} strokeWidth={2} /></IconButton>
            <UiText fontSize={22} fontWeight='600' letterSpacing={tracking(22)}>Delete account</UiText>
          </XStack>

          <Card padding={16} gap={8}>
            <UiText fontSize={14} fontWeight='600'>What gets deleted</UiText>
            <UiText fontSize={13} color={c.muted} lineHeight={18}>Your Normal login ({user?.email ?? "this account"}), your settings, devices, notifications and linked wallets on our servers. Transaction records are kept anonymised. This cannot be undone.</UiText>
            <UiText fontSize={14} fontWeight='600' paddingTop={6}>What stays</UiText>
            <UiText fontSize={13} color={c.muted} lineHeight={18}>Your crypto. Normal never holds it — it lives on the blockchains under your wallet’s keys, and your recovery phrase restores it in any compatible wallet. That is why the phrase must be saved before deleting.</UiText>
          </Card>

          {exporting ? (
            <Card padding={14} gap={12}>
              <UiText fontSize={14} fontWeight='600'>Recovery phrase — {exporting.label}</UiText>
              <UiText fontSize={12.5} color={c.muted} lineHeight={17}>Write these {exporting.words.length} words down in order and keep them offline. Anyone with them controls the funds.</UiText>
              <XStack flexWrap='wrap' gap={8}>
                {exporting.words.map((w, i) => (
                  <XStack key={`${i}-${w}`} width='31%' alignItems='center' gap={8} paddingVertical={10} paddingHorizontal={10} borderRadius={radius.input} backgroundColor={c.inputBg}>
                    <Mono fontSize={11} color={c.faint}>{i + 1}</Mono>
                    <Mono fontSize={14} selectable={false}>{w}</Mono>
                  </XStack>
                ))}
              </XStack>
              <XStack onPress={() => setExporting((e) => (e ? { ...e, saved: !e.saved } : e))} alignItems='center' gap={10} paddingVertical={4} accessibilityRole='checkbox' accessibilityState={{ checked: exporting.saved }}>
                <YStack width={22} height={22} borderRadius={6} borderWidth={1.5} borderColor={exporting.saved ? c.ink : c.borderStrong} backgroundColor={exporting.saved ? c.ink : "transparent"} alignItems='center' justifyContent='center'>
                  {exporting.saved ? <Check size={14} color={c.ctaText} strokeWidth={3} /> : null}
                </YStack>
                <UiText fontSize={14} fontWeight='500' flex={1}>I’ve written down this recovery phrase</UiText>
              </XStack>
              <PrimaryButton label='Continue' onPress={() => void finishExport()} disabled={!exporting.saved} />
            </Card>
          ) : (
            <Card padding={14} gap={14}>
              <UiText fontSize={14} fontWeight='600'>Before deleting</UiText>
              <GateRow
                code='EXPORT_REQUIRED'
                label='Recovery phrase saved'
                detail={block?.code === "EXPORT_REQUIRED" ? `${block.wallets.length === 1 ? "Your wallet’s phrase hasn’t" : `${block.wallets.length} wallets’ phrases haven’t`} been revealed in the last 24 hours. Reveal and write it down — one passkey confirmation per wallet.` : wallet ? "Verified against your wallet’s export history." : "This account has no wallet."}
              />
              {block?.code === "EXPORT_REQUIRED" ? <PrimaryButton label={exportBusy ? "Confirm with your passkey…" : "Reveal recovery phrase"} onPress={() => void exportNext()} loading={exportBusy} /> : null}
              <GateRow
                code='IN_FLIGHT'
                label='No transfers in progress'
                detail={block?.code === "IN_FLIGHT" ? `Still in flight: ${[block.counts.cctp ? `${block.counts.cctp} swap(s)` : null, block.counts.ramp ? `${block.counts.ramp} purchase/sale(s)` : null, block.counts.moneygram ? `${block.counts.moneygram} MoneyGram` : null].filter(Boolean).join(", ") || "one or more"}. Wait for them to finish (see Activity), then check again.` : undefined}
              />
              <GateRow
                code='FUNDS_PRESENT'
                label='Wallet emptied'
                detail={
                  block?.code === "FUNDS_PRESENT"
                    ? `Still holding: ${block.balances.map((b) => `${b.balance} ${b.symbol}`).join(", ") || "funds"}${block.unreadable.length ? ` (couldn’t read: ${block.unreadable.join(", ")})` : ""}. Send them out first, or confirm below that only your recovery phrase will reach them.`
                    : block?.code === "UNAVAILABLE"
                      ? `Balances couldn’t be checked right now${block.unreadable.length ? ` (${block.unreadable.join(", ")})` : ""}. Try again in a moment.`
                      : undefined
                }
              />
              {block?.code === "FUNDS_PRESENT" ? (
                <YStack gap={8}>
                  <SecondaryButton label='Send funds out first' onPress={() => router.push("/send")} />
                  <XStack onPress={() => setOverride((v) => !v)} alignItems='flex-start' gap={10} paddingVertical={2} accessibilityRole='checkbox' accessibilityState={{ checked: override }}>
                    <YStack width={22} height={22} borderRadius={6} borderWidth={1.5} borderColor={override ? c.ink : c.borderStrong} backgroundColor={override ? c.ink : "transparent"} alignItems='center' justifyContent='center' marginTop={1}>
                      {override ? <Check size={14} color={c.ctaText} strokeWidth={3} /> : null}
                    </YStack>
                    <UiText fontSize={13} flex={1} lineHeight={18}>I understand only my recovery phrase reaches these funds from now on.</UiText>
                  </XStack>
                  <SecondaryButton label='Check again' onPress={() => void runCheck(override)} disabled={checking} />
                </YStack>
              ) : block ? (
                <SecondaryButton label={checking ? "Checking…" : "Check again"} onPress={() => void runCheck()} disabled={checking} />
              ) : null}
            </Card>
          )}

          {block === null && !checking && !exporting ? (
            <Card padding={14} gap={12}>
              <XStack onPress={() => !busy && setUnderstood((v) => !v)} alignItems='flex-start' gap={10} accessibilityRole='checkbox' accessibilityState={{ checked: understood }}>
                <YStack width={22} height={22} borderRadius={6} borderWidth={1.5} borderColor={understood ? c.ink : c.borderStrong} backgroundColor={understood ? c.ink : "transparent"} alignItems='center' justifyContent='center' marginTop={1}>
                  {understood ? <Check size={14} color={c.ctaText} strokeWidth={3} /> : null}
                </YStack>
                <UiText fontSize={13} flex={1} lineHeight={18}>I understand my account data will be deleted permanently and that my crypto stays on-chain, reachable only with my recovery phrase.</UiText>
              </XStack>
              <UiText fontSize={12} color={c.muted}>Type DELETE to confirm</UiText>
              <Input value={typed} onChangeText={setTyped} autoCapitalize='characters' autoCorrect={false} placeholder='DELETE' editable={!busy} height={48} paddingHorizontal={14} fontFamily='$mono' fontSize={15} backgroundColor={c.inputBg} borderWidth={1} borderColor={c.border} borderRadius={radius.input} color={c.ink} />
              <PrimaryButton label={busy ? "Deleting…" : "Delete my account"} onPress={() => void run()} disabled={!ready} loading={busy} />
            </Card>
          ) : null}
          <UiText fontSize={12} color={c.faint} textAlign='center'>Questions? Contact us before deleting — an account can’t be restored afterwards.</UiText>
        </YStack>
      </ScrollView>
    </Screen>
  );
}
