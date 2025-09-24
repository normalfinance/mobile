import React, { useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { Alert } from "react-native";
import {
  YStack,
  XStack,
  H2,
  H3,
  H6,
  Text,
  Button,
  Input,
  TextArea,
  Separator,
  Spinner
} from "tamagui";
import { walletService } from "@/lib/wallet-management/wallet-service";
import {
  sanitizeMnemonic,
  validateMnemonic,
  getWalletErrorMessage
} from "@/lib/wallet-management/wallet-utils";

export default function WalletSetupScreen() {
  const { userId } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [mnemonic, setMnemonic] = useState("");
  const [mnemonicError, setMnemonicError] = useState("");

  const handleCreateNewWallet = async () => {
    if (!userId) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    console.log("Creating new wallet for user:", userId);
    setIsLoading(true);

    try {
      const result = await walletService.createWallet({ userId });

      if (result.success) {
        console.log("Wallet created successfully:", result.publicKey);
        Alert.alert(
          "Wallet Created!",
          `Your Stellar wallet has been created successfully.\n\nPublic Address: ${result.publicKey}`,
          [
            {
              text: "Continue",
              onPress: () => router.replace("/(tabs)")
            }
          ]
        );
      } else {
        console.error("Failed to create wallet:", result.error);
        Alert.alert(
          "Error",
          getWalletErrorMessage(result.error || "Unknown error")
        );
      }
    } catch (error) {
      console.error("Error creating wallet:", error);
      Alert.alert("Error", "Failed to create wallet. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportWallet = async () => {
    if (!userId) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    const sanitizedMnemonic = sanitizeMnemonic(mnemonic);

    if (!validateMnemonic(sanitizedMnemonic)) {
      setMnemonicError("Please enter a valid 12 or 24 word mnemonic phrase");
      return;
    }

    setMnemonicError("");
    console.log("Importing wallet for user:", userId);
    setIsLoading(true);

    try {
      const result = await walletService.importWallet({
        userId,
        mnemonic: sanitizedMnemonic
      });

      if (result.success) {
        console.log("Wallet imported successfully:", result.publicKey);
        Alert.alert(
          "Wallet Imported!",
          `Your Stellar wallet has been imported successfully.\n\nPublic Address: ${result.publicKey}`,
          [
            {
              text: "Continue",
              onPress: () => router.replace("/(tabs)")
            }
          ]
        );
      } else {
        console.error("Failed to import wallet:", result.error);
        Alert.alert(
          "Error",
          getWalletErrorMessage(result.error || "Unknown error")
        );
      }
    } catch (error) {
      console.error("Error importing wallet:", error);
      Alert.alert("Error", "Failed to import wallet. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMnemonicChange = (text: string) => {
    setMnemonic(text);
    if (mnemonicError) {
      setMnemonicError("");
    }
  };

  if (isLoading) {
    return (
      <YStack
        flex={1}
        // @ts-ignore
        justifyContent='center'
        alignItems='center'
        backgroundColor='$background'
      >
        <Spinner size='large' color='$blue10' />
        <Text mt='$4' color='$color11'>
          {showImportForm ? "Importing wallet..." : "Creating wallet..."}
        </Text>
      </YStack>
    );
  }

  return (
    // @ts-ignore
    <YStack flex={1} p='$4' backgroundColor='$background'>
      // @ts-ignore
      <YStack mt='$6' mb='$6'>
        {/* @ts-ignore */}
        <H2 textAlign='center' mb='$2'>
          Set Up Your Wallet
        </H2>
        {/* @ts-ignore */}
        <Text textAlign='center' color='$color11'>
          You need a Stellar wallet to use Normal Finance
        </Text>
      </YStack>
      {!showImportForm ? (
        // @ts-ignore
        <YStack flex={1} justifyContent='center'>
          <YStack mb='$6'>
            <Button
              size='$5'
              theme='blue'
              mb='$4'
              onPress={handleCreateNewWallet}
              disabled={isLoading}
            >
              <Text fontSize='$5' fontWeight='600'>
                Create New Wallet
              </Text>
            </Button>

            <Text
              // @ts-ignore
              textAlign='center'
              fontSize='$3'
              color='$color11'
              marginBottom='$4'
            >
              This will generate a new Stellar wallet for you
            </Text>
          </YStack>
          <XStack
            // @ts-ignore
            justifyContent='center'
            alignItems='center'
            mv='$4'
          >
            <Separator flex={1} mr='$3' />
            <Text color='$color10'>OR</Text>
            <Separator flex={1} ml='$3' />
          </XStack>
          <YStack mt='$6'>
            <Button
              size='$5'
              variant='outlined'
              onPress={() => setShowImportForm(true)}
              disabled={isLoading}
            >
              <Text fontSize='$5' fontWeight='600'>
                Import Existing Wallet
              </Text>
            </Button>

            <Text
              // @ts-ignore
              textAlign='center'
              fontSize='$3'
              color='$color11'
              marginTop='$4'
            >
              Use your existing 12 or 24 word recovery phrase
            </Text>
          </YStack>
        </YStack>
      ) : (
        <YStack flex={1}>
          <Button
            size='$3'
            variant='outlined'
            // @ts-ignore
            alignSelf='flex-start'
            mb='$4'
            onPress={() => {
              setShowImportForm(false);
              setMnemonic("");
              setMnemonicError("");
            }}
          >
            <Text>← Back</Text>
          </Button>

          <H3 mb='$4'>Import Your Wallet</H3>

          <Text fontSize='$4' color='$color11' mb='$3'>
            Enter your recovery phrase
          </Text>

          <TextArea
            size='$4'
            placeholder='Enter your 12 or 24 word recovery phrase...'
            value={mnemonic}
            onChangeText={handleMnemonicChange}
            numberOfLines={4}
            borderColor={mnemonicError ? "$red8" : "$borderColor"}
            mb='$2'
            autoCapitalize='none'
            autoCorrect={false}
          />

          {mnemonicError ? (
            <Text color='$red10' fontSize='$3' mb='$4'>
              {mnemonicError}
            </Text>
          ) : null}

          <Text fontSize='$2' color='$color10' mb='$6'>
            Your recovery phrase should be 12 or 24 words separated by spaces
          </Text>

          <Button
            size='$5'
            theme='blue'
            onPress={handleImportWallet}
            disabled={isLoading || !mnemonic.trim()}
          >
            <Text fontSize='$5' fontWeight='600'>
              Import Wallet
            </Text>
          </Button>
        </YStack>
      )}
    </YStack>
  );
}
