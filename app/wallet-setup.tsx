import React, { useCallback, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";
import { Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
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
import { ArrowLeft } from "lucide-react-native";
import {
  useCreateWallet,
  useImportWallet,
  useCreateDeterministicWallet,
  useCheckWalletExists,
  useAuthCredentials,
  useCreateWalletWithMnemonic,
  useImportFromMnemonic
} from "@/services";
import ImportMnemonicForm from "@/components/wallet/ImportMnemonicForm";
import {
  formatMnemonicForDisplay,
  splitMnemonicToWords
} from "@/lib/utils/mnemonic.utils";
import { validatePrivateKey } from "@/lib/utils/crypto.utils";

type FormattedMnemonicWord = {
  index: number;
  word: string;
};

interface VerificationQuestion {
  index: number;
  correctWord: string;
  options: string[];
}

const chunkArray = <T,>(array: T[], size: number): T[][] => {
  const result: T[][] = [];

  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }

  return result;
};

// Utility functions
export default function WalletSetupScreen() {
  const { user } = useSupabaseAuth();
  const userId = user?.id;
  const router = useRouter();
  const [showImportForm, setShowImportForm] = useState(false);
  const [importType, setImportType] = useState<"private-key" | "mnemonic">(
    "private-key"
  );
  const [privateKey, setPrivateKey] = useState("");
  const [privateKeyError, setPrivateKeyError] = useState("");
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [successStage, setSuccessStage] = useState<
    "summary" | "backup" | "verify"
  >("summary");
  const [currentMnemonic, setCurrentMnemonic] = useState("");
  const formattedMnemonic = useMemo<FormattedMnemonicWord[]>(
    () => (currentMnemonic ? formatMnemonicForDisplay(currentMnemonic) : []),
    [currentMnemonic]
  );
  const [verificationQuestions, setVerificationQuestions] = useState<
    VerificationQuestion[]
  >([]);
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<number, string>
  >({});
  const [answerErrors, setAnswerErrors] = useState<Record<number, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

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
      setSuccessStage("summary");
      setShowSuccessScreen(true);
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

  const handleSkipBackup = () => {
    Alert.alert(
      "Skip Backup?",
      "Without backing up your wallet, you won't be able to recover it if you lose access. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Skip",
          style: "destructive",
          onPress: () => {
            setShowSuccessScreen(false);
            setSuccessStage("summary");
            setCurrentMnemonic("");
            setVerificationQuestions([]);
            setSelectedAnswers({});
            setAnswerErrors({});
            setCurrentQuestionIndex(0);
            router.replace("/(tabs)");
          }
        }
      ]
    );
  };

  const handleBackupWallet = () => {
    setSuccessStage("backup");
  };

  const handleCopyMnemonic = async () => {
    if (!currentMnemonic) return;
    try {
      await Clipboard.setStringAsync(currentMnemonic);
      Alert.alert("Copied", "Recovery phrase copied to clipboard");
    } catch (error) {
      console.error("Failed to copy mnemonic:", error);
      Alert.alert("Error", "Could not copy recovery phrase. Please try again.");
    }
  };

  const startVerification = useCallback(() => {
    if (!currentMnemonic) return;

    const words = splitMnemonicToWords(currentMnemonic);
    const formatted = formatMnemonicForDisplay(currentMnemonic);
    const requiredCount = words.length >= 24 ? 3 : 2;
    const selectedIndices: number[] = [];

    while (selectedIndices.length < requiredCount) {
      const random = Math.floor(Math.random() * words.length) + 1;
      if (!selectedIndices.includes(random)) {
        selectedIndices.push(random);
      }
    }

    const questions: VerificationQuestion[] = selectedIndices
      .sort((a, b) => a - b)
      .map((index) => {
        const correctWord = words[index - 1];
        const otherOptions = formatted
          .filter((item) => item.index !== index)
          .map((item) => item.word);

        const distractors = otherOptions
          .sort(() => 0.5 - Math.random())
          .slice(0, 3);

        const options = [...distractors, correctWord].sort(
          () => 0.5 - Math.random()
        );

        return {
          index,
          correctWord,
          options
        };
      });

    setVerificationQuestions(questions);
    setSelectedAnswers({});
    setAnswerErrors({});
    setCurrentQuestionIndex(0);
    setSuccessStage("verify");
  }, [currentMnemonic]);

  const handleSelectAnswer = useCallback(
    (index: number, value: string) => {
      setSelectedAnswers((prev) => ({
        ...prev,
        [index]: value
      }));

      if (answerErrors[index]) {
        setAnswerErrors((prev) => ({
          ...prev,
          [index]: ""
        }));
      }

      // Automatically move to next question after a short delay
      if (currentQuestionIndex < verificationQuestions.length - 1) {
        setTimeout(() => {
          setCurrentQuestionIndex((prev) => prev + 1);
        }, 300);
      }
    },
    [answerErrors, currentQuestionIndex, verificationQuestions.length]
  );

  const handleVerifyBackup = () => {
    if (!currentMnemonic) {
      return;
    }

    const newErrors: Record<number, string> = {};
    let hasError = false;

    verificationQuestions.forEach(({ index, correctWord }) => {
      const answer = selectedAnswers[index];
      if (!answer) {
        newErrors[index] = "Please select an option";
        hasError = true;
      } else if (answer.toLowerCase() !== correctWord.toLowerCase()) {
        newErrors[index] = "Incorrect word";
        hasError = true;
      }
    });

    if (hasError) {
      setAnswerErrors(newErrors);
      Alert.alert(
        "Verification Failed",
        "The selected words do not match your recovery phrase. Please review and try again."
      );
      return;
    }

    Alert.alert(
      "Verification Successful",
      "Your wallet backup has been verified. Your wallet is ready to use.",
      [
        {
          text: "Continue",
          onPress: () => {
            setShowSuccessScreen(false);
            setSuccessStage("summary");
            setCurrentMnemonic("");
            setVerificationQuestions([]);
            setSelectedAnswers({});
            setAnswerErrors({});
            setCurrentQuestionIndex(0);
            router.replace("/(tabs)");
          }
        }
      ]
    );
  };

  if (showSuccessScreen && currentMnemonic) {
    if (successStage === "summary") {
      return (
        <YStack
          flex={1}
          backgroundColor='#FFFFFF'
          padding='$6'
          justifyContent='space-around'
        >
          <YStack alignItems='center' space='$4'>
            <Text
              fontSize='$10'
              fontWeight='700'
              color='#1C252E'
              textAlign='center'
            >
              Wallet Created Successfully!
            </Text>
            <XStack space='$4' alignItems='center' position='relative'>
              <Image
                source={require("@/assets/icons/auth/wallet.png")}
                style={{ width: 120, height: 120 }}
                contentFit='contain'
              />
              <Image
                source={require("@/assets/icons/auth/check.png")}
                style={{
                  width: 80,
                  height: 80,
                  position: "absolute",
                  bottom: 0,
                  right: 0
                }}
                contentFit='contain'
              />
            </XStack>
          </YStack>

          <YStack
            space='$3'
            alignItems='flex-start'
            justifyContent='flex-start'
            width={"100%"}
            backgroundColor='#F8FAFC'
            padding='$4'
            borderRadius={4}
          >
            <Text fontSize='$2' color='#637381' textAlign='left' width={"100%"}>
              Backup 12 words phrase to ensure you can recover your wallet
              later.
            </Text>
            <Button
              size='$3'
              backgroundColor='#1C252E'
              pressStyle={{ backgroundColor: "#1C252E" }}
              onPress={handleBackupWallet}
              width={"100%"}
              borderRadius={4}
            >
              <Text color='#FFFFFF' fontSize='$2' fontWeight='600'>
                Back up
              </Text>
            </Button>
            <Button
              size='$3'
              variant='outlined'
              borderColor='#E5E7EB'
              backgroundColor='transparent'
              pressStyle={{ backgroundColor: "#F9FAFB" }}
              onPress={handleSkipBackup}
              width={"100%"}
              borderRadius={4}
            >
              <Text color='#4B5563' fontSize='$2' fontWeight='600'>
                Skip for Now
              </Text>
            </Button>
          </YStack>
        </YStack>
      );
    }

    if (successStage === "backup") {
      return (
        <ScrollView
          flex={1}
          backgroundColor='#F8FAFC'
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingVertical: 15
          }}
        >
          <YStack space='$6'>
            <XStack
              alignItems='center'
              space='$3'
              justifyContent='flex-start'
              width='100%'
            >
              <Button
                size='$3'
                variant='outlined'
                borderColor='transparent'
                backgroundColor='transparent'
                pressStyle={{ opacity: 0.7 }}
                onPress={() => setSuccessStage("summary")}
                textAlign='left'
                padding='0'
                width={"auto"}
                height={"auto"}
              >
                <ArrowLeft size={24} color='#637381' />
              </Button>
            </XStack>

            <YStack space='$3' paddingHorizontal='0'>
              <Text fontSize='$6' fontWeight='700' color='#1C252E'>
                Backup Your Wallet
              </Text>
              <Text fontSize='$2' color='#637381' fontWeight='700'>
                Write down these words in order and keep them in a safe place.
                {"\n"}
                You will need them to recover your wallet.
              </Text>
            </YStack>

            <YStack space='$4'>
              {chunkArray(formattedMnemonic, 3).map((row, rowIndex) => (
                <XStack
                  key={rowIndex}
                  space='$2'
                  justifyContent='space-between'
                >
                  {row.map((item) => (
                    <XStack
                      key={item.index}
                      flex={1}
                      justifyContent='center'
                      alignItems='center'
                      space='$2'
                      padding='$3'
                      backgroundColor='#FFFFFF'
                      borderRadius={6}
                      borderWidth={1}
                      borderColor='#919EAB1F'
                    >
                      {/* <Text fontSize='$2' color='#94A3B8' fontWeight='500'>
                        {item.index}
                      </Text> */}
                      <Text fontSize='$2' color='#1E293B' fontWeight='600'>
                        {item.word}
                      </Text>
                    </XStack>
                  ))}
                </XStack>
              ))}
            </YStack>

            <YStack space='$3'>
              <Button
                size='$3'
                backgroundColor='#1C252E'
                pressStyle={{ backgroundColor: "#1C252E" }}
                onPress={startVerification}
                width={"100%"}
                borderRadius={4}
              >
                <Text color='#FFFFFF' fontSize='$2' fontWeight='600'>
                  I've Written It Down
                </Text>
              </Button>

              <Button
                size='$3'
                variant='outlined'
                borderColor='#E5E7EB'
                backgroundColor='transparent'
                pressStyle={{ backgroundColor: "#F9FAFB" }}
                onPress={handleCopyMnemonic}
                width={"100%"}
                borderRadius={4}
              >
                <Text color='#4B5563' fontSize='$2' fontWeight='600'>
                  Copy to Clipboard
                </Text>
              </Button>
            </YStack>
          </YStack>
        </ScrollView>
      );
    }

    if (successStage === "verify") {
      const currentQuestion = verificationQuestions[currentQuestionIndex];
      const isLastQuestion =
        currentQuestionIndex === verificationQuestions.length - 1;

      return (
        <YStack
          flex={1}
          backgroundColor='#FFFFFF'
          padding='$6'
          justifyContent='space-between'
        >
          <XStack
            alignItems='center'
            justifyContent='flex-start'
            width='100%'
            marginBottom='$4'
            space='$3'
          >
            <Button
              size='$3'
              variant='outlined'
              borderColor='transparent'
              backgroundColor='transparent'
              pressStyle={{ opacity: 0.7 }}
              onPress={() => setSuccessStage("summary")}
              textAlign='left'
              padding='0'
              width={"auto"}
              height={"auto"}
            >
              <ArrowLeft size={24} color='#637381' />
            </Button>
          </XStack>
          <YStack
            flex={1}
            justifyContent='flex-start'
            space='$8'
            alignItems='flex-start'
          >
            {/* Question Content */}
            {currentQuestion && (
              <YStack space='$5' alignItems='flex-start' width='100%'>
                <YStack space='$3' alignItems='flex-start' width='100%'>
                  <Text
                    fontSize={24}
                    fontWeight='700'
                    color='#1C252E'
                    textAlign='center'
                  >
                    Verify Your Backup
                  </Text>
                  {/* Progress Dots */}
                  <XStack justifyContent='center' space='$3'>
                    {verificationQuestions.map((_, index) => (
                      <YStack
                        key={index}
                        width={10}
                        height={10}
                        borderRadius={5}
                        backgroundColor={
                          index === currentQuestionIndex
                            ? "#4B5563"
                            : index < currentQuestionIndex
                            ? "#94A3B8"
                            : "#E5E7EB"
                        }
                      />
                    ))}
                  </XStack>
                  <Text
                    fontSize='$2'
                    fontWeight='700'
                    color='#1E293B'
                    textAlign='center'
                  >
                    Select the {currentQuestion.index}
                    {currentQuestion.index === 1
                      ? "st"
                      : currentQuestion.index === 2
                      ? "nd"
                      : currentQuestion.index === 3
                      ? "rd"
                      : "th"}{" "}
                    word
                  </Text>
                </YStack>

                <YStack
                  width='100%'
                  space='$2'
                  alignItems='flex-start'
                  justifyContent='flex-start'
                >
                  {currentQuestion.options.map((option, optIndex) => {
                    const isSelected =
                      selectedAnswers[currentQuestion.index] === option;
                    const hasError = answerErrors[currentQuestion.index];

                    return (
                      <Button
                        key={optIndex}
                        height={46}
                        variant='outlined'
                        textAlign='left'
                        borderRadius={4}
                        borderColor={
                          hasError && isSelected
                            ? "#EF4444"
                            : isSelected
                            ? "#919EABB0"
                            : "#919EAB1F"
                        }
                        borderWidth={1}
                        backgroundColor={isSelected ? "#F8FAFC" : "#FFFFFF"}
                        pressStyle={{
                          backgroundColor: "#F9FAFB",
                          borderColor: "#4B5563"
                        }}
                        onPress={() =>
                          handleSelectAnswer(currentQuestion.index, option)
                        }
                        width='100%'
                      >
                        <Text
                          color={
                            hasError && isSelected
                              ? "#EF4444"
                              : isSelected
                              ? "#1C252E"
                              : "#637381"
                          }
                          fontSize={12}
                          fontWeight={"700"}
                          textAlign='center'
                        >
                          {option}
                        </Text>
                      </Button>
                    );
                  })}
                </YStack>

                {answerErrors[currentQuestion.index] && (
                  <Text fontSize='$3' color='#EF4444'>
                    {answerErrors[currentQuestion.index]}
                  </Text>
                )}
              </YStack>
            )}
          </YStack>

          {/* Bottom Buttons */}
          <YStack space='$3'>
            {isLastQuestion && (
              <Button
                size='$5'
                backgroundColor='#4B5563'
                pressStyle={{ backgroundColor: "#374151" }}
                onPress={handleVerifyBackup}
              >
                <Text color='#FFFFFF' fontSize='$5' fontWeight='600'>
                  Verify Backup
                </Text>
              </Button>
            )}

            {currentQuestionIndex > 0 && !isLastQuestion && (
              <Button
                size='$4'
                variant='outlined'
                borderColor='#E5E7EB'
                backgroundColor='transparent'
                pressStyle={{ backgroundColor: "#F9FAFB" }}
                onPress={() => setCurrentQuestionIndex((prev) => prev - 1)}
                borderRadius={4}
                width='100%'
              >
                <Text color='#1C252E' fontSize={14} fontWeight='600'>
                  Previous Question
                </Text>
              </Button>
            )}
          </YStack>
        </YStack>
      );
    }
  }

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
    </ScrollView>
  );
}
