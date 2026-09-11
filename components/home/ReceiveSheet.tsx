// Receive modal, after web's receive-modal.tsx: dialog r22, QR panel r16 on the
// input background, address box r12 in 12px mono, copy button r10. Chain-aware:
// one pill per chain the wallet has an address for, with a per-chain warning —
// funds sent on the wrong network are unrecoverable.

import React from "react";
import { Modal } from "react-native";
import { XStack, YStack } from "tamagui";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import { Check, Copy, TriangleAlert, X } from "lucide-react-native";

import { CHAIN_META, type WalletAddress, type WalletChain } from "@/hooks/use-turnkey-wallet";
import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";
import { IconButton, Mono, SecondaryButton, UiText } from "./primitives";

export const ReceiveSheet = ({
  open,
  addresses,
  initialChain,
  onClose
}: {
  open: boolean;
  addresses: WalletAddress[];
  initialChain?: WalletChain;
  onClose: () => void;
}) => {
  const c = useColors();
  const [chain, setChain] = React.useState<WalletChain | null>(null);
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pick the requested chain when opening, else the first one available.
  React.useEffect(() => {
    if (!open) return;
    const wanted = initialChain && addresses.some((a) => a.chain === initialChain)
      ? initialChain
      : addresses[0]?.chain ?? null;
    setChain(wanted);
    setCopied(false);
  }, [open, initialChain, addresses]);

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
              Receive
            </UiText>
            <IconButton onPress={onClose} label='Close'>
              <X size={20} color={c.muted} strokeWidth={2} />
            </IconButton>
          </XStack>

          {addresses.length === 0 ? (
            <UiText fontSize={14} color={c.muted}>
              This wallet has no addresses yet.
            </UiText>
          ) : (
            <>
              {/* Chain pills — only chains with an address (D: filter pill 12/600) */}
              <XStack gap={6} flexWrap='wrap'>
                {addresses.map(({ chain: k }) => {
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

              {current && meta ? (
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
                      {meta.warning} Anything else will be lost.
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
                      {meta.name} address · {meta.assets}
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
