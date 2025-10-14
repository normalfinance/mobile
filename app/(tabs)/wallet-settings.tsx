import React, { useMemo, useState } from "react";
import { Alert, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { ArrowLeft, Copy, Eye } from "lucide-react-native";
import { Button, Text, View, XStack, YStack } from "tamagui";

import { useWallet } from "@/services";

export default function WalletSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: walletInfo, isLoading } = useWallet();
  const [isCopying, setIsCopying] = useState(false);

  const publicAddress = walletInfo?.publicKey ?? "";
  const truncatedAddress = useMemo(() => {
    if (!publicAddress) return "";
    const start = publicAddress.slice(0, 10);
    const end = publicAddress.slice(-10);
    return `${start}...${end}`;
  }, [publicAddress]);

  const handleCopy = async () => {
    if (!publicAddress || isCopying) return;
    try {
      setIsCopying(true);
      await Clipboard.setStringAsync(publicAddress);
      Alert.alert("Copied", "Wallet address copied to clipboard");
    } catch (error) {
      console.error("Failed to copy wallet address", error);
      Alert.alert("Error", "Unable to copy wallet address. Please try again.");
    } finally {
      setIsCopying(false);
    }
  };

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
                  icon={<Copy size={18} color='#0F172A' />}
                  onPress={handleCopy}
                  disabled={!publicAddress || isCopying}
                  theme='light'
                  backgroundColor='#EEF2FF'
                  color='#0F172A'
                >
                  <Text>{isCopying ? "Copying..." : "Copy Address"}</Text>
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
              <Button>
                <Text>Reveal Recovery Phrase</Text>
              </Button>
            </YStack>
          </YStack>
        </YStack>
      </YStack>
    </SafeAreaView>
  );
}
