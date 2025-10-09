import React, { useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { Alert } from "react-native";
import { Image } from "expo-image";
import {
  YStack,
  XStack,
  Text,
  Button,
  TextArea,
  Spinner,
  ScrollView,
  Separator
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
        justifyContent='center'
        alignItems='center'
        backgroundColor='#F6F8FF'
      >
        <Spinner size='large' color='#2563EB' />
        <Text mt='$4' color='#4B5567'>
          {showImportForm ? "Importing wallet..." : "Creating wallet..."}
        </Text>
      </YStack>
    );
  }

  return (
    <ScrollView
      flex={1}
      backgroundColor='#FFFFFF'
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingVertical: 40,
        alignItems: "center"
      }}
    >
      <YStack
        width='100%'
        space='$6'
        alignItems='center'
        justifyContent='center'
        flex={1}
      >
        <YStack alignItems='center' space='$4'>
          <Text fontSize='$10' fontWeight='700' color='#1C252E'>
            Wallet Setup
          </Text>
          <Image
            source={require("@/assets/icons/auth/wallet.png")}
            style={{ width: 240, height: 240 }}
            contentFit='contain'
          />
        </YStack>

        {!showImportForm ? (
          <YStack
            backgroundColor='#F8FAFC'
            borderRadius={14}
            width='100%'
            p='$4'
            space='$5'
          >
            <YStack space='$3'>
              <Text fontSize={16} fontWeight='500' color='#637381'>
                Dont have a wallet?
              </Text>
              <Button
                height={46}
                borderRadius={4}
                backgroundColor='#4B5563'
                pressStyle={{ backgroundColor: "#374151" }}
                onPress={handleCreateNewWallet}
                disabled={isLoading}
              >
                <Text color='#FFFFFF' fontSize={14} fontWeight='700'>
                  Create a new wallet
                </Text>
              </Button>
            </YStack>

            <YStack space='$3'>
              <Text fontSize={16} fontWeight='500' color='#637381'>
                Already have a wallet?
              </Text>
              <Button
                height={42}
                borderRadius={4}
                backgroundColor='#0F172A'
                pressStyle={{ backgroundColor: "#0B1220" }}
                onPress={() => setShowImportForm(true)}
                disabled={isLoading}
              >
                <Text color='#FFFFFF' fontSize={14} fontWeight='700'>
                  Import an existing wallet
                </Text>
              </Button>
            </YStack>
          </YStack>
        ) : (
          <YStack width='100%' space='$5'>
            <Button
              size='$3'
              variant='outlined'
              alignSelf='flex-start'
              borderRadius={14}
              px='$4'
              onPress={() => {
                setShowImportForm(false);
                setPrivateKey("");
                setPrivateKeyError("");
                setImportType("private-key");
              }}
            >
              <Text fontSize={15} fontWeight='500'>
                ← Back
              </Text>
            </Button>

            <YStack
              backgroundColor='#FFFFFF'
              borderRadius={24}
              p='$5'
              space='$4'
              shadowColor='rgba(15, 23, 42, 0.12)'
              shadowOffset={{ width: 0, height: 16 }}
              shadowOpacity={0.08}
              shadowRadius={28}
            >
              <Text fontSize={22} fontWeight='600' color='#0F172A'>
                Import your wallet
              </Text>

              <XStack
                backgroundColor='#F1F5F9'
                borderRadius={14}
                p='$1'
                space='$2'
              >
                <Button
                  flex={1}
                  height={46}
                  borderRadius={12}
                  backgroundColor={
                    importType === "private-key" ? "#FFFFFF" : "transparent"
                  }
                  color={importType === "private-key" ? "#0F172A" : "#6B7280"}
                  onPress={() => setImportType("private-key")}
                >
                  <Text
                    fontSize={14}
                    fontWeight='600'
                    color={importType === "private-key" ? "#0F172A" : "#6B7280"}
                  >
                    Private key
                  </Text>
                </Button>
                <Button
                  flex={1}
                  height={46}
                  borderRadius={12}
                  backgroundColor={
                    importType === "mnemonic" ? "#FFFFFF" : "transparent"
                  }
                  color={importType === "mnemonic" ? "#0F172A" : "#6B7280"}
                  onPress={() => setImportType("mnemonic")}
                >
                  <Text
                    fontSize={14}
                    fontWeight='600'
                    color={importType === "mnemonic" ? "#0F172A" : "#6B7280"}
                  >
                    Recovery phrase
                  </Text>
                </Button>
              </XStack>

              {importType === "private-key" ? (
                <YStack space='$3'>
                  <Text fontSize={15} color='#4B5563'>
                    Enter your private key below to import your Stellar wallet.
                  </Text>

                  <TextArea
                    size='$4'
                    placeholder='Enter your Stellar private key (starts with S...)'
                    value={privateKey}
                    onChangeText={handlePrivateKeyChange}
                    numberOfLines={4}
                    borderRadius={16}
                    borderColor={privateKeyError ? "#F87171" : "#E2E8F0"}
                    backgroundColor='#F8FAFC'
                    color='#0F172A'
                    autoCapitalize='none'
                    autoCorrect={false}
                    px='$4'
                    py='$3'
                  />

                  {privateKeyError ? (
                    <Text color='#DC2626' fontSize={13}>
                      {privateKeyError}
                    </Text>
                  ) : null}

                  <Text fontSize={12} color='#94A3B8'>
                    Your private key should start with "S" and be 56 characters
                    long.
                  </Text>

                  <Button
                    height={52}
                    borderRadius={16}
                    backgroundColor='#0F172A'
                    pressStyle={{ backgroundColor: "#0B1220" }}
                    onPress={handleImportWallet}
                    disabled={isLoading || !privateKey.trim()}
                  >
                    <Text color='#FFFFFF' fontSize={15} fontWeight='600'>
                      Import wallet
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
          </YStack>
        )}
      </YStack>

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
    </ScrollView>
  );
}
