import React, { useState } from "react";
import {
  YStack,
  XStack,
  H3,
  H4,
  Text,
  Button,
  TextArea,
  Card,
  Separator,
  ScrollView
} from "tamagui";
import {
  validateMnemonic,
  normalizeMnemonic,
  isMnemonicComplete,
  splitMnemonicToWords
} from "@/lib/utils/mnemonic.utils";

interface ImportMnemonicFormProps {
  onImport: (mnemonic: string) => void;
  onBack: () => void;
  isLoading?: boolean;
  error?: string;
}

const ImportMnemonicForm: React.FC<ImportMnemonicFormProps> = ({
  onImport,
  onBack,
  isLoading = false,
  error
}) => {
  const [mnemonic, setMnemonic] = useState("");
  const [mnemonicError, setMnemonicError] = useState("");
  const [wordCount, setWordCount] = useState(0);

  const handleMnemonicChange = (text: string) => {
    setMnemonic(text);
    setMnemonicError("");

    // Update word count
    const words = splitMnemonicToWords(text);
    setWordCount(words.filter((word) => word.length > 0).length);
  };

  const handleImport = () => {
    const normalizedMnemonic = normalizeMnemonic(mnemonic);

    if (!normalizedMnemonic) {
      setMnemonicError("Please enter your recovery phrase");
      return;
    }

    if (!isMnemonicComplete(normalizedMnemonic)) {
      setMnemonicError("Recovery phrase must contain exactly 24 words");
      return;
    }

    if (!validateMnemonic(normalizedMnemonic)) {
      setMnemonicError(
        "Invalid recovery phrase. Please check your words and try again."
      );
      return;
    }

    onImport(normalizedMnemonic);
  };

  const isValidWordCount = wordCount === 24;
  const hasValidMnemonic =
    mnemonic.trim() && validateMnemonic(normalizeMnemonic(mnemonic));

  return (
    <ScrollView flex={1} showsVerticalScrollIndicator={false}>
      <YStack space='$4'>
        <XStack
          // @ts-ignore
          justifyContent='flex-start'
          alignItems='center'
          mb='$2'
        >
          <Button size='$3' variant='outlined' onPress={onBack}>
            <Text>← Back</Text>
          </Button>
        </XStack>

        <H3>Import from Recovery Phrase</H3>

        <Card
          // @ts-ignore
          backgroundColor='$blue2'
          borderColor='$blue8'
          p='$4'
        >
          <Text fontSize='$4' fontWeight='600' color='$blue11' mb='$2'>
            🔐 Recovery Phrase Import
          </Text>
          <Text color='$blue11' fontSize='$3' lineHeight='$1'>
            Enter your 24-word recovery phrase to restore your wallet. Make sure
            to enter the words in the correct order.
          </Text>
        </Card>

        <YStack space='$3'>
          <H4>Enter Your Recovery Phrase</H4>

          <TextArea
            size='$4'
            placeholder='Enter your 24-word recovery phrase here, separated by spaces...'
            value={mnemonic}
            onChangeText={handleMnemonicChange}
            numberOfLines={6}
            borderColor={
              mnemonicError || error
                ? "$red8"
                : hasValidMnemonic
                ? "$green8"
                : "$borderColor"
            }
            autoCapitalize='none'
            autoCorrect={false}
            autoComplete='off'
            // @ts-ignore
            textAlign='left'
          />

          <XStack
            // @ts-ignore
            justifyContent='space-between'
            alignItems='center'
          >
            <Text fontSize='$3' color='$color10'>
              Words: {wordCount}/24
            </Text>
            {hasValidMnemonic && (
              <XStack
                // @ts-ignore
                alignItems='center'
                space='$1'
              >
                <Text fontSize='$3' color='$green10'>
                  ✓ Valid phrase
                </Text>
              </XStack>
            )}
          </XStack>

          {(mnemonicError || error) && (
            <Text color='$red10' fontSize='$3'>
              {mnemonicError || error}
            </Text>
          )}

          <Card
            // @ts-ignore
            backgroundColor='$gray2'
            p='$3'
          >
            <Text fontSize='$3' color='$color11' lineHeight='$1'>
              <Text fontWeight='600'>Tips:</Text>
              {"\n"}• Words should be separated by spaces{"\n"}• Must be exactly
              24 words{"\n"}• Check spelling carefully{"\n"}• Case doesn't
              matter
            </Text>
          </Card>
        </YStack>

        <Separator my='$2' />

        <YStack space='$3'>
          <Button
            size='$5'
            theme='blue'
            onPress={handleImport}
            disabled={!isValidWordCount || !hasValidMnemonic || isLoading}
            opacity={isValidWordCount && hasValidMnemonic ? 1 : 0.5}
          >
            <Text fontSize='$5' fontWeight='600'>
              {isLoading ? "Importing Wallet..." : "Import Wallet"}
            </Text>
          </Button>

          <Text
            // @ts-ignore
            textAlign='center'
            fontSize='$2'
            color='$color10'
          >
            Your wallet will be restored with all your assets and transaction
            history
          </Text>
        </YStack>

        <Card
          // @ts-ignore
          backgroundColor='$yellow2'
          borderColor='$yellow8'
          p='$4'
          mt='$4'
        >
          <Text fontSize='$3' color='$yellow11' fontWeight='600' mb='$2'>
            ⚠️ Security Reminder
          </Text>
          <Text color='$yellow11' fontSize='$3' lineHeight='$1'>
            Never share your recovery phrase with anyone. Anyone with access to
            your recovery phrase can control your wallet and funds.
          </Text>
        </Card>
      </YStack>
    </ScrollView>
  );
};

export default ImportMnemonicForm;
