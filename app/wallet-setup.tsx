import React, { useState, useEffect } from "react";
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
import {
  useCreateWallet,
  useImportWallet,
  useCreateDeterministicWallet,
  useCheckWalletExists,
  useAuthCredentials,
  useCreateWalletWithMnemonic,
  useImportFromMnemonic
} from "@/services";
import BackupPhraseModal from "@/components/wallet/BackupPhraseModal";
import VerificationModal from "@/components/wallet/VerificationModal";
import ImportMnemonicForm from "@/components/wallet/ImportMnemonicForm";

// Utility functions
const validatePrivateKey = (privateKey: string) => {
  // Stellar private keys start with 'S' and are 56 characters long
  const trimmed = privateKey.trim();
  return trimmed.length === 56 && trimmed.startsWith("S");
};

const getWalletErrorMessage = (error: string) => {
  return error || "An unknown error occurred";
};

export default function WalletSetupScreen() {
  const { userId } = useAuth();
  const router = useRouter();
  const [showImportForm, setShowImportForm] = useState(false);
  const [importType, setImportType] = useState<"private-key" | "mnemonic">(
    "private-key"
  );
  const [privateKey, setPrivateKey] = useState("");
  const [privateKeyError, setPrivateKeyError] = useState("");
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [currentMnemonic, setCurrentMnemonic] = useState("");

  const createWallet = useCreateWallet();
  const importWallet = useImportWallet();
  const createDeterministicWallet = useCreateDeterministicWallet();
  const createWalletWithMnemonic = useCreateWalletWithMnemonic();
  const importFromMnemonic = useImportFromMnemonic();
  const { data: credentials } = useAuthCredentials();
  const { data: walletCheck, isLoading: checkingWallet } =
    useCheckWalletExists(credentials);

  const isLoading =
    createWallet.isPending ||
    importWallet.isPending ||
    createDeterministicWallet.isPending ||
    createWalletWithMnemonic.isPending ||
    importFromMnemonic.isPending ||
    checkingWallet;

  const handleCreateNewWallet = async () => {
    if (!userId) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    // Check if wallet already exists
    if (walletCheck?.exists) {
      Alert.alert(
        "Wallet Exists",
        "You already have a wallet associated with this account."
      );
      return;
    }

    console.log("Creating new wallet with mnemonic for user:", userId);

    try {
      const result = await createWalletWithMnemonic.mutateAsync();

      console.log("Wallet created successfully:", result.publicKey);
      setCurrentMnemonic(result.mnemonic);

      Alert.alert(
        "Wallet Created! 🎉",
        `Your Stellar wallet has been created successfully.\n\nPublic Address: ${result.publicKey}`,
        [
          {
            text: "Backup Wallet",
            onPress: () => setShowBackupModal(true)
          },
          {
            text: "Skip Backup",
            style: "destructive",
            onPress: () => {
              Alert.alert(
                "Skip Backup?",
                "Without backing up your wallet, you won't be able to recover it if you lose access. Are you sure?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Skip",
                    style: "destructive",
                    onPress: () => {
                      router.replace("/(tabs)");
                    }
                  }
                ]
              );
            }
          }
        ]
      );
    } catch (error) {
      console.error("Error creating wallet with mnemonic:", error);
      Alert.alert("Error", "Failed to create wallet. Please try again.");
    }
  };

  const handleImportWallet = async () => {
    if (!userId) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    const trimmedPrivateKey = privateKey.trim();

    if (!validatePrivateKey(trimmedPrivateKey)) {
      setPrivateKeyError(
        "Please enter a valid Stellar private key (starts with 'S' and is 56 characters long)"
      );
      return;
    }

    setPrivateKeyError("");
    console.log("Importing wallet for user:", userId);

    try {
      const result = await importWallet.mutateAsync({
        privateKey: trimmedPrivateKey
      });

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
    } catch (error) {
      console.error("Error importing wallet:", error);
      Alert.alert("Error", "Failed to import wallet. Please try again.");
    }
  };

  const handlePrivateKeyChange = (text: string) => {
    setPrivateKey(text);
    if (privateKeyError) {
      setPrivateKeyError("");
    }
  };

  const handleMnemonicImport = async (mnemonic: string) => {
    if (!userId) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    try {
      const result = await importFromMnemonic.mutateAsync({ mnemonic });

      console.log(
        "Wallet imported from mnemonic successfully:",
        result.publicKey
      );
      Alert.alert(
        "Wallet Imported! 🎉",
        `Your Stellar wallet has been imported successfully.\n\nPublic Address: ${result.publicKey}`,
        [
          {
            text: "Continue",
            onPress: () => router.replace("/(tabs)")
          }
        ]
      );
    } catch (error) {
      console.error("Error importing wallet from mnemonic:", error);
      return; // Error will be displayed by the form component
    }
  };

  const handleBackupConfirmed = () => {
    setShowBackupModal(false);
    setShowVerificationModal(true);
  };

  const handleVerificationComplete = () => {
    setShowVerificationModal(false);
    setCurrentMnemonic(""); // Clear mnemonic from memory
    router.replace("/(tabs)");
  };

  const handleCloseBackup = () => {
    setShowBackupModal(false);
    setCurrentMnemonic(""); // Clear mnemonic from memory
  };

  const handleCloseVerification = () => {
    setShowVerificationModal(false);
    setShowBackupModal(true); // Go back to backup modal
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
              This will create a new Stellar wallet linked to your account
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
              Use your existing private key or recovery phrase
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
              setPrivateKey("");
              setPrivateKeyError("");
              setImportType("private-key");
            }}
          >
            <Text>← Back</Text>
          </Button>

          <H3 mb='$4'>Import Your Wallet</H3>

          <XStack space='$2' mb='$4'>
            <Button
              size='$3'
              variant={
                importType === "private-key" ? "solid" : ("outlined" as any)
              }
              theme={importType === "private-key" ? "blue" : undefined}
              onPress={() => setImportType("private-key")}
              flex={1}
            >
              <Text>Private Key</Text>
            </Button>
            <Button
              size='$3'
              variant={
                importType === "mnemonic" ? "solid" : ("outlined" as any)
              }
              theme={importType === "mnemonic" ? "blue" : undefined}
              onPress={() => setImportType("mnemonic")}
              flex={1}
            >
              <Text>Recovery Phrase</Text>
            </Button>
          </XStack>

          {importType === "private-key" ? (
            <YStack space='$3'>
              <Text fontSize='$4' color='$color11' mb='$3'>
                Enter your private key
              </Text>

              <TextArea
                size='$4'
                placeholder='Enter your Stellar private key (starts with S...)'
                value={privateKey}
                onChangeText={handlePrivateKeyChange}
                numberOfLines={3}
                borderColor={privateKeyError ? "$red8" : "$borderColor"}
                mb='$2'
                autoCapitalize='none'
                autoCorrect={false}
              />

              {privateKeyError ? (
                <Text color='$red10' fontSize='$3' mb='$4'>
                  {privateKeyError}
                </Text>
              ) : null}

              <Text fontSize='$2' color='$color10' mb='$6'>
                Your private key should start with 'S' and be 56 characters long
              </Text>

              <Button
                size='$5'
                theme='blue'
                onPress={handleImportWallet}
                disabled={isLoading || !privateKey.trim()}
              >
                <Text fontSize='$5' fontWeight='600'>
                  Import Wallet
                </Text>
              </Button>
            </YStack>
          ) : (
            <ImportMnemonicForm
              onImport={handleMnemonicImport}
              onBack={() => setImportType("private-key")}
              isLoading={importFromMnemonic.isPending}
              error={importFromMnemonic.error?.message}
            />
          )}
        </YStack>
      )}
      <BackupPhraseModal
        visible={showBackupModal}
        mnemonic={currentMnemonic}
        onClose={handleCloseBackup}
        onBackupConfirmed={handleBackupConfirmed}
      />
      <VerificationModal
        visible={showVerificationModal}
        mnemonic={currentMnemonic}
        onClose={handleCloseVerification}
        onVerificationComplete={handleVerificationComplete}
      />
    </YStack>
  );
}
