import React, { useState, useEffect } from "react";
import {
  YStack,
  XStack,
  H3,
  H4,
  Text,
  Button,
  Input,
  Card,
  Separator
} from "tamagui";
import { Modal, Alert } from "react-native";
import {
  getRandomVerificationWords,
  verifyMnemonicWords,
  type MnemonicVerificationWord
} from "@/lib/utils/mnemonic.utils";

interface VerificationModalProps {
  visible: boolean;
  mnemonic: string;
  onClose: () => void;
  onVerificationComplete: () => void;
}

const VerificationModal: React.FC<VerificationModalProps> = ({
  visible,
  mnemonic,
  onClose,
  onVerificationComplete
}) => {
  const [verificationWords, setVerificationWords] = useState<MnemonicVerificationWord[]>([]);
  const [userInputs, setUserInputs] = useState<{ [key: number]: string }>({});
  const [errors, setErrors] = useState<{ [key: number]: string }>({});
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (visible && mnemonic) {
      // Generate random words for verification when modal opens
      const randomWords = getRandomVerificationWords(mnemonic, 2);
      setVerificationWords(randomWords);
      setUserInputs({});
      setErrors({});
    }
  }, [visible, mnemonic]);

  const handleInputChange = (index: number, value: string) => {
    setUserInputs(prev => ({
      ...prev,
      [index]: value
    }));
    
    // Clear error when user starts typing
    if (errors[index]) {
      setErrors(prev => ({
        ...prev,
        [index]: ""
      }));
    }
  };

  const handleVerification = () => {
    setIsVerifying(true);
    
    // Prepare verification data
    const verificationData = verificationWords.map(word => ({
      index: word.index,
      userInput: userInputs[word.index] || ""
    }));

    // Check if all fields are filled
    const hasEmptyFields = verificationData.some(item => !item.userInput.trim());
    if (hasEmptyFields) {
      const newErrors: { [key: number]: string } = {};
      verificationData.forEach(item => {
        if (!item.userInput.trim()) {
          newErrors[item.index] = "This field is required";
        }
      });
      setErrors(newErrors);
      setIsVerifying(false);
      return;
    }

    // Verify the words
    const isValid = verifyMnemonicWords(mnemonic, verificationData);
    
    if (isValid) {
      Alert.alert(
        "Verification Successful! 🎉",
        "Your wallet backup has been verified. Your wallet is now ready to use.",
        [
          {
            text: "Continue",
            onPress: onVerificationComplete
          }
        ]
      );
    } else {
      // Show which words are incorrect
      const newErrors: { [key: number]: string } = {};
      verificationData.forEach(item => {
        const correctWord = verificationWords.find(w => w.index === item.index)?.word;
        if (correctWord && correctWord.toLowerCase() !== item.userInput.toLowerCase().trim()) {
          newErrors[item.index] = "Incorrect word. Please check your backup phrase.";
        }
      });
      setErrors(newErrors);
      
      Alert.alert(
        "Verification Failed",
        "One or more words don't match your backup phrase. Please check your written backup and try again.",
        [{ text: "OK" }]
      );
    }
    
    setIsVerifying(false);
  };

  const handleBack = () => {
    Alert.alert(
      "Go Back",
      "Going back will generate new verification words. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Go Back", onPress: onClose }
      ]
    );
  };

  const allFieldsFilled = verificationWords.every(word => 
    userInputs[word.index]?.trim()
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleBack}
    >
      <YStack
        flex={1}
        // @ts-ignore
        backgroundColor="$background"
        p="$4"
      >
        <XStack
          // @ts-ignore
          justifyContent="space-between"
          alignItems="center"
          mb="$4"
        >
          <Button
            size="$3"
            variant="outlined"
            onPress={handleBack}
          >
            <Text>← Back</Text>
          </Button>
          <H3>Verify Backup</H3>
          <YStack width="$6" />
        </XStack>

        <YStack flex={1} space="$4">
          <Card
            // @ts-ignore
            backgroundColor="$blue2"
            borderColor="$blue8"
            p="$4"
          >
            <Text
              fontSize="$4"
              fontWeight="600"
              color="$blue11"
              mb="$2"
            >
              ✅ Verification Step
            </Text>
            <Text color="$blue11" fontSize="$3" lineHeight="$1">
              Enter the requested words from your backup phrase to confirm you wrote them down correctly.
            </Text>
          </Card>

          <YStack space="$4" flex={1}>
            <H4>Enter the following words:</H4>
            
            {verificationWords.map((word, idx) => (
              <YStack key={word.index} space="$2">
                <Text fontSize="$4" fontWeight="500">
                  Word #{word.index}
                </Text>
                <Input
                  size="$4"
                  placeholder={`Enter word #${word.index}`}
                  value={userInputs[word.index] || ""}
                  onChangeText={(value) => handleInputChange(word.index, value)}
                  borderColor={errors[word.index] ? "$red8" : "$borderColor"}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                />
                {errors[word.index] && (
                  <Text color="$red10" fontSize="$3">
                    {errors[word.index]}
                  </Text>
                )}
              </YStack>
            ))}
          </YStack>

          <Separator my="$2" />
          
          <Text
            // @ts-ignore
            textAlign="center"
            fontSize="$3"
            color="$color10"
            mb="$4"
          >
            Make sure to match the exact spelling and order from your backup phrase
          </Text>
        </YStack>

        <YStack space="$3">
          <Button
            size="$5"
            theme="green"
            onPress={handleVerification}
            disabled={!allFieldsFilled || isVerifying}
            opacity={allFieldsFilled ? 1 : 0.5}
          >
            <Text fontSize="$5" fontWeight="600">
              {isVerifying ? "Verifying..." : "Verify Backup"}
            </Text>
          </Button>
          
          <Text
            // @ts-ignore
            textAlign="center"
            fontSize="$2"
            color="$color10"
          >
            This verification ensures your backup is written correctly
          </Text>
        </YStack>
      </YStack>
    </Modal>
  );
};

export default VerificationModal;