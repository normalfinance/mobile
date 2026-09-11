// Receive modal, after web's receive-modal.tsx: dialog r22, QR panel r16 on the
// input background, address box r12 in 12px mono, copy button r10.

import React from "react";
import { Modal } from "react-native";
import { XStack, YStack } from "tamagui";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import { Check, Copy, X } from "lucide-react-native";

import { useColors } from "@/lib/theme/appearance";
import { radius, space, tracking } from "@/lib/theme/tokens";
import { IconButton, Mono, SecondaryButton, UiText } from "./primitives";

export const ReceiveSheet = ({
  open,
  address,
  onClose
}: {
  open: boolean;
  address: string | null;
  onClose: () => void;
}) => {
  const c = useColors();
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const copy = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
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
          gap={16}
        >
          <XStack justifyContent='space-between' alignItems='center'>
            <UiText fontSize={16} fontWeight='600'>
              Receive
            </UiText>
            <IconButton onPress={onClose} label='Close'>
              <X size={20} color={c.muted} strokeWidth={2} />
            </IconButton>
          </XStack>

          <UiText fontSize={14} color={c.body50}>
            Stellar address. Send XLM or USDC on Stellar only — assets from other
            networks will be lost.
          </UiText>

          {address ? (
            <>
              <YStack
                alignItems='center'
                padding={20}
                borderRadius={radius.card}
                backgroundColor='#FAFAFB'
              >
                <QRCode value={address} size={180} backgroundColor='#FAFAFB' />
              </YStack>

              <YStack padding={12} borderRadius={radius.input} backgroundColor={c.inputBg}>
                <Mono fontSize={12} letterSpacing={tracking(12)} selectable>
                  {address}
                </Mono>
              </YStack>

              <SecondaryButton
                onPress={copy}
                label={copied ? "Copied" : "Copy address"}
                icon={
                  copied ? (
                    <Check size={16} color={c.positive} strokeWidth={2} />
                  ) : (
                    <Copy size={16} color={c.ink} strokeWidth={2} />
                  )
                }
              />
            </>
          ) : (
            <UiText fontSize={14} color={c.muted}>
              This wallet has no Stellar address yet.
            </UiText>
          )}
        </YStack>
      </YStack>
    </Modal>
  );
};
