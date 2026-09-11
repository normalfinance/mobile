// Receive modal, after web's receive-modal.tsx: dialog r22, QR panel r16 on
// #FAFAFB, address box r12 on #FAFAFB in 12px mono, copy button r10 white 13px.

import React from "react";
import { Modal } from "react-native";
import { XStack, YStack } from "tamagui";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import { Check, Copy, X } from "lucide-react-native";

import { ink, radius, space, tracking } from "@/lib/theme/tokens";
import { Mono, UiText } from "./primitives";

export const ReceiveSheet = ({
  open,
  address,
  onClose
}: {
  open: boolean;
  address: string | null;
  onClose: () => void;
}) => {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal visible={open} transparent animationType='slide' onRequestClose={onClose}>
      <YStack flex={1} justifyContent='flex-end' backgroundColor='rgba(10,10,15,0.35)'>
        <YStack
          backgroundColor={ink.surface}
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
            <YStack
              onPress={onClose}
              width={32}
              height={32}
              borderRadius={radius.iconBox}
              alignItems='center'
              justifyContent='center'
              pressStyle={{ backgroundColor: ink.iconPressTint }}
            >
              <X size={20} color={ink.muted} strokeWidth={2} />
            </YStack>
          </XStack>

          <UiText fontSize={14} color={ink.body50}>
            Stellar address. Send XLM or USDC on Stellar only — assets from other
            networks will be lost.
          </UiText>

          {address ? (
            <>
              <YStack
                alignItems='center'
                padding={20}
                borderRadius={radius.card}
                backgroundColor={ink.inputBg}
              >
                <QRCode value={address} size={180} backgroundColor={ink.inputBg} />
              </YStack>

              <YStack
                padding={12}
                borderRadius={radius.input}
                backgroundColor={ink.inputBg}
              >
                <Mono fontSize={12} letterSpacing={tracking(12)} selectable>
                  {address}
                </Mono>
              </YStack>

              <XStack
                onPress={copy}
                height={40}
                borderRadius={radius.smallButton}
                borderWidth={1}
                borderColor={ink.border}
                backgroundColor={ink.surface}
                pressStyle={{ backgroundColor: ink.iconBg }}
                alignItems='center'
                justifyContent='center'
                gap={8}
              >
                {copied ? (
                  <Check size={16} color={ink.positive} strokeWidth={2} />
                ) : (
                  <Copy size={16} color={ink.ink} strokeWidth={2} />
                )}
                <UiText fontSize={13} fontWeight='500'>
                  {copied ? "Copied" : "Copy address"}
                </UiText>
              </XStack>
            </>
          ) : (
            <UiText fontSize={14} color={ink.muted}>
              This wallet has no Stellar address yet.
            </UiText>
          )}
        </YStack>
      </YStack>
    </Modal>
  );
};
