// Receive modal, after web's receive-modal.tsx: dialog r22, QR panel r16 on the
// input background, address box r12 in 12px mono, copy button r10. Chain-aware:
// one pill per chain the wallet has an address for, with a per-chain warning —
// funds sent on the wrong network are unrecoverable.

import React from "react";
import { Alert, Modal } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { XStack, YStack } from "tamagui";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import { Check, Copy, TriangleAlert, X } from "lucide-react-native";

import { useStellarAccountProbe } from "@/hooks/use-savings";
import { CHAIN_META, turnkeyWalletQueryKey, useTurnkeyWallet, type WalletAddress, type WalletChain } from "@/hooks/use-turnkey-wallet";
import { refreshAfterStellarAction } from "@/lib/data/after-action";
import { addUsdcTrustline, deriveSetupStep } from "@/lib/savings/engine";
import { ensureDeviceReady } from "@/lib/turnkey/device-check";
import { useDeviceReady } from "@/lib/turnkey/device-ready";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";
import { describeTurnkeyError, isUserCancelledError } from "@/lib/turnkey/client";
import { provisionChain } from "@/lib/turnkey/provision";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";
import { IconButton, Mono, PrimaryButton, SecondaryButton, UiText } from "./primitives";

const ALL_CHAINS: WalletChain[] = ["stellar", "bitcoin", "ethereum", "solana"];

export const ReceiveSheet = ({
  open,
  addresses,
  initialChain,
  asset,
  onClose
}: {
  open: boolean;
  addresses: WalletAddress[];
  initialChain?: WalletChain;
  /** "USDC" = the Stellar address must also be activated and hold a USDC trustline
   *  (web receive gates: deriveSetupStep) — anything sent before that is rejected. */
  asset?: string;
  onClose: () => void;
}) => {
  const c = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useSupabaseAuth();
  const { wallet, refetch: refetchWallet } = useTurnkeyWallet();
  const { ready: deviceReady } = useDeviceReady(wallet?.subOrgId);
  const usdc = asset === "USDC";
  const [chain, setChain] = React.useState<WalletChain | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [settingUp, setSettingUp] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pick the requested chain when opening, else the first with an address,
  // else Stellar. Kept while open, so a just-provisioned chain stays selected.
  React.useEffect(() => {
    if (!open) return;
    setChain(usdc ? "stellar" : initialChain ?? addresses[0]?.chain ?? "stellar");
    setCopied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialChain, usdc]);

  // USDC on Stellar: the account must exist (funded with XLM) and carry the
  // USDC trustline before anyone sends USDC to it. Probed only while this
  // sheet is open for USDC and the step isn't done.
  const stellarAddress = addresses.find((a) => a.chain === "stellar")?.address ?? null;
  const [watchProbe, setWatchProbe] = React.useState(true);
  const probe = useStellarAccountProbe(usdc && open ? stellarAddress : null, usdc && open && watchProbe);
  const usdcStep = usdc ? deriveSetupStep(probe.data ?? null) : null;
  React.useEffect(() => {
    setWatchProbe(usdcStep !== "ready");
  }, [usdcStep]);
  const [addingTrustline, setAddingTrustline] = React.useState(false);
  const addTrustline = async () => {
    if (!wallet?.subOrgId || !stellarAddress) return;
    setAddingTrustline(true);
    try {
      const gate = await ensureDeviceReady(wallet.subOrgId, stellarAddress, deviceReady);
      if (gate.outcome === "needs-setup") {
        onClose();
        router.push("/setup-device");
        return;
      }
      if (gate.outcome === "cancelled") return;
      if (gate.outcome === "failed") throw gate.error;
      await addUsdcTrustline({ subOrgId: wallet.subOrgId, address: stellarAddress });
      await probe.refetch();
      void refreshAfterStellarAction(queryClient, { userId: user?.id, stellarAddress });
    } catch (e) {
      if (!isUserCancelledError(e)) Alert.alert("Couldn’t add the trustline", e instanceof Error ? e.message : describeTurnkeyError(e));
    } finally {
      setAddingTrustline(false);
    }
  };

  // Lazy creation (hard rule 7): no address on this chain yet → one passkey
  // creates it here, whether or not a Normal wallet exists at all.
  const setUp = async (k: WalletChain) => {
    if (!user) return;
    setSettingUp(true);
    try {
      const updated = await provisionChain({ user, wallet, chain: k });
      queryClient.setQueryData(turnkeyWalletQueryKey(user.id), updated);
      await refetchWallet();
    } catch (e) {
      if (!isUserCancelledError(e)) Alert.alert("Couldn’t set up the chain", describeTurnkeyError(e));
    } finally {
      setSettingUp(false);
    }
  };

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const current = addresses.find((a) => a.chain === chain) ?? null;
  const meta = chain ? CHAIN_META[chain] : null;

  const copy = async () => {
    if (!current) return;
    await Clipboard.setStringAsync(current.address);
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal visible={open} transparent animationType='slide' onRequestClose={onClose}>
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
              {usdc ? "Receive USDC" : "Receive"}
            </UiText>
            <IconButton onPress={onClose} label='Close'>
              <X size={20} color={c.muted} strokeWidth={2} />
            </IconButton>
          </XStack>

          {(
            <>
              {/* Chain pills — every chain; the ones without an address set up on tap (pill 12/600). USDC lives on Stellar only. */}
              <XStack gap={6} flexWrap='wrap'>
                {(usdc ? (["stellar"] as WalletChain[]) : ALL_CHAINS).map((k) => {
                  const selected = k === chain;
                  return (
                    <XStack
                      key={k}
                      onPress={() => {
                        setChain(k);
                        setCopied(false);
                      }}
                      alignItems='center'
                      gap={6}
                      paddingHorizontal={12}
                      height={32}
                      borderRadius={radius.pill}
                      borderWidth={1}
                      borderColor={selected ? c.ink : c.border}
                      backgroundColor={selected ? c.ink : "transparent"}
                      pressStyle={{ backgroundColor: selected ? c.ctaPressed : c.pressTint }}
                      accessibilityRole='tab'
                      accessibilityState={{ selected }}
                    >
                      <YStack
                        width={8}
                        height={8}
                        borderRadius={4}
                        backgroundColor={CHAIN_META[k].color}
                      />
                      <UiText
                        fontSize={12}
                        fontWeight='600'
                        color={selected ? c.ctaText : c.ink}
                      >
                        {CHAIN_META[k].name}
                      </UiText>
                    </XStack>
                  );
                })}
              </XStack>

              {!current && meta ? (
                <YStack gap={10} paddingTop={4}>
                  <UiText fontSize={13} color={c.muted} lineHeight={18}>
                    {wallet ? `Your Normal wallet has no ${meta.name} address yet. One passkey confirmation adds it on the same wallet.` : `You don’t have a Normal wallet yet. One passkey confirmation creates it with a ${meta.name} address — nothing to write down.`}
                  </UiText>
                  <PrimaryButton label={settingUp ? "Confirm with your passkey…" : `Set up ${meta.name}`} onPress={() => void setUp(meta ? (chain as WalletChain) : "stellar")} loading={settingUp} />
                </YStack>
              ) : null}

              {current && meta && usdc && usdcStep !== "ready" ? (
                // USDC gates, in the web's order: activate (fund with XLM) → trustline → ready.
                <YStack gap={10}>
                  {usdcStep === null ? (
                    <UiText fontSize={13} color={c.muted}>Checking your Stellar account…</UiText>
                  ) : usdcStep === "activate" ? (
                    <>
                      <XStack alignItems='flex-start' gap={8} padding={12} borderRadius={radius.input} backgroundColor={c.chips.amber.bg}>
                        <TriangleAlert size={16} color={c.chips.amber.color} strokeWidth={2} />
                        <UiText fontSize={13} color={c.chips.amber.color} flex={1} lineHeight={18}>
                          Don’t send USDC yet — it would be rejected. Your Stellar account needs a little XLM first: receive about 3 XLM to the address below (1 activates it, 0.5 is reserved for the USDC trustline, the rest pays fees). It activates by itself when the XLM lands.
                        </UiText>
                      </XStack>
                      <PrimaryButton label='Buy XLM with a card' onPress={() => { onClose(); router.push({ pathname: "/buy", params: { asset: "XLM" } }); }} />
                    </>
                  ) : (
                    <>
                      <UiText fontSize={13} color={c.muted} lineHeight={18}>
                        Your Stellar account is active. Add the USDC trustline so it can hold USDC — one passkey confirmation, a tiny network fee. Until then, USDC sent here is rejected.
                      </UiText>
                      <PrimaryButton label={addingTrustline ? "Confirm with your passkey…" : "Add USDC trustline"} onPress={() => void addTrustline()} loading={addingTrustline} />
                    </>
                  )}
                </YStack>
              ) : null}

              {current && meta && (!usdc || usdcStep === "activate" || usdcStep === "ready") ? (
                <>
                  <XStack
                    alignItems='flex-start'
                    gap={8}
                    padding={12}
                    borderRadius={radius.input}
                    backgroundColor={c.chips.amber.bg}
                  >
                    <TriangleAlert size={16} color={c.chips.amber.color} strokeWidth={2} />
                    <UiText fontSize={13} color={c.chips.amber.color} flex={1} lineHeight={18}>
                      {usdc && usdcStep === "activate" ? "Send XLM only to this address for now." : usdc ? "Send USDC on the Stellar network only — not Ethereum, Solana or Base USDC." : `${meta.warning} Anything else will be lost.`}
                    </UiText>
                  </XStack>

                  <YStack
                    alignItems='center'
                    padding={20}
                    borderRadius={radius.card}
                    backgroundColor='#FAFAFB'
                  >
                    <QRCode value={current.address} size={180} backgroundColor='#FAFAFB' />
                  </YStack>

                  <YStack gap={6}>
                    <UiText fontSize={12} color={c.muted}>
                      {usdc ? (usdcStep === "ready" ? "Stellar address · USDC trustline ready" : "Stellar address · XLM to activate") : `${meta.name} address · ${meta.assets}`}
                    </UiText>
                    <YStack
                      padding={12}
                      borderRadius={radius.input}
                      backgroundColor={c.inputBg}
                    >
                      <Mono fontSize={12} letterSpacing={tracking(12)} selectable>
                        {current.address}
                      </Mono>
                    </YStack>
                  </YStack>

                  <SecondaryButton
                    onPress={copy}
                    label={copied ? "Copied" : `Copy ${meta.name} address`}
                    icon={
                      copied ? (
                        <Check size={16} color={c.positive} strokeWidth={2} />
                      ) : (
                        <Copy size={16} color={c.ink} strokeWidth={2} />
                      )
                    }
                  />
                </>
              ) : null}
            </>
          )}
        </YStack>
      </YStack>
    </Modal>
  );
};
