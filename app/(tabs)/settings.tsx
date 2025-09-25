import React, { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { Alert } from "react-native";
import {
  YStack,
  XStack,
  H2,
  H4,
  Text,
  Button,
  Card,
  Separator,
  Spinner
} from "tamagui";
import { Clipboard } from "react-native";
import { SignOutButton } from "@/components/sign-out";
import { useWallet, WalletInfo } from "@/services";

// Utility functions
const formatDate = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString();
};

const truncateAddress = (address: string, start = 6, end = 6) => {
  if (!address) return '';
  if (address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};

export default function SettingsScreen() {
  const { userId } = useAuth();
  const [isCopying, setIsCopying] = useState(false);
  const { data: walletInfo, isLoading } = useWallet();

  const handleCopyAddress = async () => {
    if (!walletInfo?.publicKey) return;

    setIsCopying(true);
    try {
      Clipboard.setString(walletInfo.publicKey);
      console.log("Address copied to clipboard:", walletInfo.publicKey);
      Alert.alert("Copied!", "Wallet address copied to clipboard");
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      Alert.alert("Error", "Failed to copy address to clipboard");
    } finally {
      setIsCopying(false);
    }
  };

  return (
    // @ts-ignore
    <YStack flex={1} backgroundColor='$background'>
      // @ts-ignore
      <YStack p='$4'>
        // @ts-ignore
        <H2 mb='$4'>Settings</H2>

        {isLoading ? (
          // @ts-ignore
          <YStack alignItems='center' justifyContent='center' height='$10'>
            <Spinner size='large' color='$blue10' />
            <Text mt='$2' color='$color11'>
              Loading wallet info...
            </Text>
          </YStack>
        ) : walletInfo ? (
          // @ts-ignore
          <YStack marginBottom='$6'>
            <Card elevate size='$4' bordered marginBottom='$4'>
              <Card.Header>
                // @ts-ignore
                <H4>Your Stellar Wallet</H4>
              </Card.Header>
              <Card.Footer padded>
                <YStack space='$3'>
                  <YStack space='$2'>
                    <Text fontSize='$3' fontWeight='600' color='$color11'>
                      Public Address
                    </Text>
                    {/* @ts-ignore */}
                    <XStack alignItems='center' space='$2'>
                      <Text
                        fontSize='$4'
                        // @ts-ignore
                        fontFamily='$mono'
                        color='$color12'
                        flex={1}
                        numberOfLines={1}
                      >
                        {truncateAddress(walletInfo.publicKey, 12, 12)}
                      </Text>
                      <Button
                        size='$3'
                        variant='outlined'
                        // @ts-ignore
                        onPress={handleCopyAddress}
                        disabled={isCopying}
                      >
                        <Text fontSize='$2'>
                          {isCopying ? "Copying..." : "Copy"}
                        </Text>
                      </Button>
                    </XStack>
                  </YStack>

                  <Separator />

                  <YStack space='$2'>
                    <Text fontSize='$3' fontWeight='600' color='$color11'>
                      Wallet Details
                    </Text>
                    {/* @ts-ignore */}
                    <XStack justifyContent='space-between'>
                      <Text fontSize='$3' color='$color10'>
                        Created:
                      </Text>
                      <Text fontSize='$3' color='$color12'>
                        {formatDate(new Date())}
                      </Text>
                    </XStack>
                    {/* @ts-ignore */}
                    <XStack justifyContent='space-between'>
                      <Text fontSize='$3' color='$color10'>
                        Type:
                      </Text>
                      <Text fontSize='$3' color='$color12'>
                        Stellar Wallet
                      </Text>
                    </XStack>
                  </YStack>

                  <Separator />

                  <Button
                    size='$3'
                    variant='outlined'
                    theme='blue'
                    onPress={handleCopyAddress}
                    disabled={isCopying}
                  >
                    <Text>Copy Full Address</Text>
                  </Button>
                </YStack>
              </Card.Footer>
            </Card>
          </YStack>
        ) : (
          <Card elevate size='$4' bordered marginBottom='$4'>
            <Card.Header>
              <H4>Wallet Not Found</H4>
            </Card.Header>
            <Card.Footer padded>
              <Text color='$color11'>
                No wallet information available. Please contact support if this
                is unexpected.
              </Text>
            </Card.Footer>
          </Card>
        )}

        <SignOutButton />
      </YStack>
    </YStack>
  );
}
