// Receive modal, after web's receive-modal.tsx: dialog r22, QR panel r16 on the
// input background, address box r12 in 12px mono, copy button r10. Asset-aware:
// one pill per asset (XLM · USDC · BTC · ETH · SOL; USDC = Stellar with the
// activate → trustline gates), chains without an address set up on tap, a
// per-chain warning — funds sent on the wrong network are unrecoverable — and
// an incoming-payment watcher on every chain while the sheet is open.

import React from "react";
import { Alert, Modal } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { XStack, YStack } from "tamagui";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import { Check, Copy, TriangleAlert, X } from "lucide-react-native";

import { incomingSats, useBtcAddressWatch } from "@/hooks/use-btc-address-watch";
import { useIncomingWatch } from "@/hooks/use-incoming-watch";
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

type ReceiveAsset = "XLM" | "USDC" | "BTC" | "ETH" | "SOL";
const ASSETS: { asset: ReceiveAsset; chain: WalletChain }[] = [
  { asset: "XLM", chain: "stellar" },
  { asset: "USDC", chain: "stellar" },
  { asset: "BTC", chain: "bitcoin" },
  { asset: "ETH", chain: "ethereum" },
  { asset: "SOL", chain: "solana" }
];
const ASSET_FOR_CHAIN: Record<WalletChain, ReceiveAsset> = { stellar: "XLM", bitcoin: "BTC", ethereum: "ETH", solana: "SOL" };

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
  const [picked, setPicked] = React.useState<ReceiveAsset | null>(null);
  const usdc = picked === "USDC";
  const [chain, setChain] = React.useState<WalletChain | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [settingUp, setSettingUp] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pick the requested chain when opening, else the first with an address,
  // else Stellar. Kept while open, so a just-provisioned chain stays selected.
  React.useEffect(() => {
    if (!open) return;
    const startChain = asset === "USDC" ? "stellar" : initialChain ?? addresses[0]?.chain ?? "stellar";
    setChain(startChain);
    setPicked(asset === "USDC" ? "USDC" : ASSET_FOR_CHAIN[startChain]);
    setCopied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialChain, asset]);

  // USDC on Stellar: the account must exist (funded with XLM) and carry the
  // USDC trustline before anyone sends USDC to it. Probed only while this
  // sheet is open for USDC and the step isn't done.
  const stellarAddress = addresses.find((a) => a.chain === "stellar")?.address ?? null;
  const [watchProbe, setWatchProbe] = React.useState(true);
  const probe = useStellarAccountProbe(usdc && open ? stellarAddress : null, usdc && open && watchProbe);
  const usdcStep = usdc ? deriveSetupStep(probe.data ?? null) : null;
  // Bitcoin: unconfirmed payments to this address show up here within seconds
  // (mempool WebSocket + 20 s poll), only while the sheet is open on Bitcoin.
  const btcAddress = addresses.find((a) => a.chain === "bitcoin")?.address ?? null;
  const btcWatch = useBtcAddressWatch(btcAddress, open && chain === "bitcoin");
  // Every other chain: balance-diff watcher (Stellar XLM + USDC, ETH, SOL).
  const currentAddress = addresses.find((a) => a.chain === chain)?.address ?? null;
  const incoming = useIncomingWatch(chain, currentAddress, open && chain !== "bitcoin");
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
              {picked ? `Receive ${picked}` : "Receive"}
            </UiText>
            <IconButton onPress={onClose} label='Close'>
              <X size={20} color={c.muted} strokeWidth={2} />
            </IconButton>
          </XStack>

          {(
            <>
              {/* Asset pills — every asset; chains without an address set up on tap (pill 12/600). USDC lives on Stellar only. */}
              <XStack gap={6} flexWrap='wrap'>
                {ASSETS.map(({ asset: a, chain: k }) => {
                  const selected = a === picked;
                  return (
                    <XStack
                      key={a}
                      onPress={() => {
                        setPicked(a);
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
                        {a}
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

                  {chain === "bitcoin" && btcWatch.incomingTxs.length > 0 ? (
                    <YStack gap={6} padding={12} borderRadius={radius.input} backgroundColor={c.chips.blue.bg}>
                      {btcWatch.incomingTxs.map((tx) => (
                        <XStack key={tx.txid} justifyContent='space-between' alignItems='center' gap={12}>
                          <UiText fontSize={13} color={c.chips.blue.color} flex={1}>Incoming · {tx.status.confirmed ? "confirmed" : "confirming (~10 min)"}</UiText>
                          <Mono fontSize={13} color={c.chips.blue.color}>+{(incomingSats(tx, current.address) / 1e8).toFixed(8).replace(/\.?0+$/, "")} BTC</Mono>
                        </XStack>
                      ))}
                    </YStack>
                  ) : chain === "bitcoin" ? (
                    <UiText fontSize={12} color={c.faint} textAlign='center'>{btcWatch.isConnected ? "Watching the Bitcoin network — an incoming payment appears here within seconds." : "Connecting to the Bitcoin network…"}</UiText>
                  ) : incoming.receipts.length > 0 ? (
                    <YStack gap={6} padding={12} borderRadius={radius.input} backgroundColor={c.chips.green.bg}>
                      {incoming.receipts.map((r) => (
                        <XStack key={r.symbol} justifyContent='space-between' alignItems='center' gap={12}>
                          <UiText fontSize={13} color={c.chips.green.color} flex={1}>Received · confirmed on {meta.name}</UiText>
                          <Mono fontSize={13} color={c.chips.green.color}>+{r.amount.toFixed(r.symbol === "ETH" ? 6 : r.symbol === "SOL" ? 4 : 2).replace(/\.?0+$/, "")} {r.symbol}</Mono>
                        </XStack>
                      ))}
                    </YStack>
                  ) : (
                    <UiText fontSize={12} color={c.faint} textAlign='center'>{incoming.watching ? `Watching ${meta.name} — a payment to this address shows here when it lands.` : `Connecting to ${meta.name}…`}</UiText>
                  )}

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
