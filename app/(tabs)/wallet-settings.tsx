import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { ArrowLeft, Check, Copy, Eye, EyeOff } from "lucide-react-native";
import { Button, Card, Separator, Text, View, XStack, YStack } from "tamagui";

import { useMnemonic, useWallet } from "@/services";
import { formatMnemonicForDisplay } from "@/lib/utils/mnemonic.utils";

export default function WalletSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: walletInfo, isLoading } = useWallet();
  const { data: mnemonic } = useMnemonic(true);
  const [isCopyingAddress, setIsCopyingAddress] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const addressCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [mnemonicCopied, setMnemonicCopied] = useState(false);
  const mnemonicCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [isRevealModalVisible, setIsRevealModalVisible] = useState(false);
  const [isHoldingReveal, setIsHoldingReveal] = useState(false);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const HOLD_DURATION_MS = 3000;
  const holdSecondsRemaining = Math.max(
    0,
    Math.ceil((HOLD_DURATION_MS / 1000) * (1 - holdProgress))
  );

  const publicAddress = walletInfo?.publicKey ?? "";
  const truncatedAddress = useMemo(() => {
    if (!publicAddress) return "";
    const start = publicAddress.slice(0, 10);
    const end = publicAddress.slice(-10);
    return `${start}...${end}`;
  }, [publicAddress]);

  const handleCopy = async () => {
    if (!publicAddress || isCopyingAddress) return;
    try {
      setIsCopyingAddress(true);
      await Clipboard.setStringAsync(publicAddress);
      setAddressCopied(true);
      if (addressCopyTimeoutRef.current) {
        clearTimeout(addressCopyTimeoutRef.current);
      }
      addressCopyTimeoutRef.current = setTimeout(() => {
        setAddressCopied(false);
        addressCopyTimeoutRef.current = null;
      }, 2000);
    } catch (error) {
      console.error("Failed to copy wallet address", error);
      Alert.alert("Error", "Unable to copy wallet address. Please try again.");
    } finally {
      setIsCopyingAddress(false);
    }
  };

  const handleCopyMnemonic = async () => {
    if (!mnemonic) return;
    try {
      await Clipboard.setStringAsync(mnemonic);
      setMnemonicCopied(true);
      if (mnemonicCopyTimeoutRef.current) {
        clearTimeout(mnemonicCopyTimeoutRef.current);
      }
      mnemonicCopyTimeoutRef.current = setTimeout(() => {
        setMnemonicCopied(false);
        mnemonicCopyTimeoutRef.current = null;
      }, 2000);
    } catch (error) {
      console.error("Failed to copy mnemonic", error);
      Alert.alert("Error", "Unable to copy recovery phrase. Please try again.");
    }
  };

  const formattedMnemonic = useMemo(() => {
    if (!mnemonic) return [];
    return formatMnemonicForDisplay(mnemonic);
  }, [mnemonic]);

  const resetHoldState = () => {
    setIsHoldingReveal(false);
    setHoldProgress(0);
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  const startHoldTimer = () => {
    if (!mnemonic || isHoldingReveal) return;

    setIsHoldingReveal(true);
    setHoldProgress(0);
    const tickInterval = 100;
    let elapsed = 0;

    holdIntervalRef.current = setInterval(() => {
      elapsed += tickInterval;
      setHoldProgress(Math.min(elapsed / HOLD_DURATION_MS, 1));
    }, tickInterval);

    holdTimeoutRef.current = setTimeout(() => {
      setIsRevealModalVisible(true);
      resetHoldState();
    }, HOLD_DURATION_MS);
  };

  const cancelHoldTimer = () => {
    if (!isHoldingReveal) return;
    resetHoldState();
  };

  useEffect(() => {
    return () => {
      resetHoldState();
      if (addressCopyTimeoutRef.current) {
        clearTimeout(addressCopyTimeoutRef.current);
        addressCopyTimeoutRef.current = null;
      }
      if (mnemonicCopyTimeoutRef.current) {
        clearTimeout(mnemonicCopyTimeoutRef.current);
        mnemonicCopyTimeoutRef.current = null;
      }
    };
  }, []);

  // return (
  //   <View>
  //     <Text>Test</Text>
  //   </View>
  // );

  return (
    <SafeAreaView style={{ flex: 1, paddingBottom: 0 }}>
      <YStack flex={1} backgroundColor='#F4F7FB' paddingVertical={20}>
        <YStack paddingHorizontal='$4' paddingBottom='$6' space='$5' flex={1}>
          <XStack alignItems='center' justifyContent='space-between'>
            <Button
              unstyled
              onPress={() => router.back()}
              accessibilityLabel='Go back'
              hitSlop={12}
            >
              <ArrowLeft size={24} color='#1B1D28' />
            </Button>
            <Text fontSize='$6' fontWeight='600' color='#1B1D28'>
              Wallet Settings
            </Text>
            <View width={24} />
          </XStack>

          <YStack space='$5' flex={1}>
            <YStack
              backgroundColor='#FFFFFF'
              borderRadius={8}
              paddingHorizontal='$4'
              paddingVertical='$5'
              borderWidth={1}
              borderColor='#E2E8F0'
              space='$4'
            >
              <YStack space='$1'>
                <Text fontSize='$3' color='#6B7280'>
                  Public Address
                </Text>
              </YStack>

              <YStack
                padding='$3'
                borderRadius={8}
                backgroundColor='#F1F5F9'
                borderWidth={1}
                borderColor='#E2E8F0'
              >
                <Text
                  fontSize='$3'
                  color='#1B1D28'
                  selectable
                  numberOfLines={1}
                >
                  {publicAddress || ""}
                </Text>
              </YStack>

              <XStack>
                <Button
                  flex={1}
                  icon={
                    addressCopied ? (
                      <Check size={18} color='#FFFFFF' />
                    ) : (
                      <Copy size={18} color='#0F172A' />
                    )
                  }
                  onPress={handleCopy}
                  disabled={!publicAddress || isCopyingAddress}
                  backgroundColor={addressCopied ? "#22C55E" : "#EEF2FF"}
                >
                  <Text color={addressCopied ? "#FFFFFF" : "#0F172A"}>
                    {addressCopied ? "Copied" : "Copy Address"}
                  </Text>
                </Button>
              </XStack>
            </YStack>

            <YStack
              backgroundColor='#FFFFFF'
              borderRadius={8}
              paddingHorizontal='$4'
              paddingVertical='$5'
              borderWidth={1}
              borderColor='#E2E8F0'
              space='$4'
            >
              <YStack space='$2'>
                <Text fontSize='$4' fontWeight='600' color='#1B1D28'>
                  Recovery Phrase
                </Text>
                <Text fontSize='$3' color='#6B7280'>
                  Keep your recovery phrase safe. Never share it with anyone.
                </Text>
              </YStack>
              <Button
                onPressIn={startHoldTimer}
                onPressOut={cancelHoldTimer}
                onLongPress={() => {}}
                disabled={!mnemonic}
                opacity={mnemonic ? 1 : 0.5}
                backgroundColor='#1D4ED8'
                theme='active'
              >
                <XStack alignItems='center' justifyContent='center' space='$2'>
                  <Eye size={18} color='#FFFFFF' />
                  <Text color='#FFFFFF' fontWeight='600'>
                    {isHoldingReveal
                      ? `Hold for ${holdSecondsRemaining}s`
                      : "Hold to Reveal"}
                  </Text>
                </XStack>
              </Button>
              {isHoldingReveal && (
                <Text fontSize='$2' color='#1D4ED8' textAlign='center'>
                  Continue holding to reveal your recovery phrase
                </Text>
              )}
            </YStack>
          </YStack>
        </YStack>
      </YStack>
      <Modal
        visible={isRevealModalVisible}
        animationType='slide'
        transparent
        onRequestClose={() => setIsRevealModalVisible(false)}
      >
        <YStack
          flex={1}
          justifyContent='center'
          alignItems='center'
          backgroundColor='rgba(0,0,0,0.6)'
          paddingHorizontal='$4'
        >
          <Card
            width='100%'
            maxWidth={400}
            padding='$4'
            borderRadius='$5'
            backgroundColor='#FFFFFF'
            space='$4'
          >
            <YStack space='$3'>
              <XStack alignItems='center' justifyContent='space-between'>
                <Text fontSize='$5' fontWeight='700' color='#1B1D28'>
                  Recovery Phrase
                </Text>
                <Button
                  unstyled
                  onPress={() => setIsRevealModalVisible(false)}
                  accessibilityLabel='Close recovery phrase modal'
                >
                  <EyeOff size={20} color='#1B1D28' />
                </Button>
              </XStack>
              <Text fontSize='$3' color='#6B7280'>
                Write down these words in order and store them securely.
              </Text>
            </YStack>

            <Separator />

            <YStack space='$3'>
              {formattedMnemonic.length > 0 ? (
                <YStack space='$2'>
                  {Array.from({
                    length: Math.ceil(formattedMnemonic.length / 3)
                  }).map((_, rowIndex) => (
                    <XStack key={rowIndex} space='$2'>
                      {formattedMnemonic
                        .slice(rowIndex * 3, rowIndex * 3 + 3)
                        .map((word) => (
                          <XStack
                            key={word.index}
                            flex={1}
                            padding='$3'
                            borderRadius='$3'
                            backgroundColor='#F1F5F9'
                            space='$2'
                          >
                            <Text color='#1E3A8A' fontWeight='600'>
                              {word.index}.
                            </Text>
                            <Text color='#1B1D28'>{word.word}</Text>
                          </XStack>
                        ))}
                    </XStack>
                  ))}
                </YStack>
              ) : (
                <Text color='#6B7280'>
                  Recovery phrase not available. Please ensure you have backed
                  up your wallet.
                </Text>
              )}
            </YStack>

            <Separator />

            <Button
              icon={
                mnemonicCopied ? (
                  <Check size={18} color='#FFFFFF' />
                ) : (
                  <Copy size={18} color='#FFFFFF' />
                )
              }
              backgroundColor={mnemonicCopied ? "#22C55E" : "#2563EB"}
              onPress={handleCopyMnemonic}
              disabled={!mnemonic}
            >
              <Text color='#FFFFFF'>
                {mnemonicCopied ? "Copied" : "Copy Recovery Phrase"}
              </Text>
            </Button>

            <Button
              variant='outlined'
              onPress={() => setIsRevealModalVisible(false)}
            >
              <Text>Close</Text>
            </Button>
          </Card>
        </YStack>
      </Modal>
    </SafeAreaView>
  );
}
