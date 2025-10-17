import React, { useState } from "react";
import {
  YStack,
  XStack,
  H3,
  H4,
  Text,
  Button,
  Card,
  Separator,
  ScrollView
} from "tamagui";
import { Modal, Alert } from "react-native";
import { formatMnemonicForDisplay } from "@/lib/utils/mnemonic.utils";

interface BackupPhraseModalProps {
  visible: boolean;
  mnemonic: string;
  onClose: () => void;
  onBackupConfirmed: () => void;
}

const BackupPhraseModal: React.FC<BackupPhraseModalProps> = ({
  visible,
  mnemonic,
  onClose,
  onBackupConfirmed
}) => {
  const [hasConfirmedReading, setHasConfirmedReading] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const mnemonicWords = formatMnemonicForDisplay(mnemonic);

  const handleProceedToVerification = () => {
    if (!hasConfirmedReading) {
      setShowWarning(true);
      return;
    }

    onBackupConfirmed();
  };

  const handleClose = () => {
    Alert.alert(
      "Close Backup",
      "Are you sure you want to close without backing up your wallet? You'll need this phrase to recover your wallet.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Close", style: "destructive", onPress: onClose }
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType='slide'
      presentationStyle='pageSheet'
      onRequestClose={handleClose}
    >
      <YStack
        flex={1}
        // @ts-ignore
        backgroundColor='$background'
        p='$4'
      >
        <XStack
          // @ts-ignore
          justifyContent='space-between'
          alignItems='center'
          mb='$4'
        >
          <Button size='$3' variant='outlined' onPress={handleClose}>
            <Text>Cancel</Text>
          </Button>
          <H3>Backup Your Wallet</H3>
          <YStack width='$6' />
        </XStack>

        <ScrollView flex={1} showsVerticalScrollIndicator={false}>
          <YStack space='$4'>
            <YStack space='$3'>
              <H4>Your Recovery Phrase</H4>
              <Text color='$color11' fontSize='$3'>
                Write down these 24 words in order:
              </Text>

              <Card
                // @ts-ignore
                backgroundColor='$gray2'
                p='$4'
              >
                <YStack space='$2'>
                  {Array.from({ length: 6 }, (_, rowIndex) => (
                    <XStack
                      key={rowIndex}
                      // @ts-ignore
                      justifyContent='space-between'
                      space='$2'
                    >
                      {Array.from({ length: 4 }, (_, colIndex) => {
                        const wordIndex = rowIndex * 4 + colIndex;
                        const wordData = mnemonicWords[wordIndex];

                        if (!wordData) {
                          return null;
                        }

                        return (
                          <XStack
                            key={wordIndex}
                            flex={1}
                            // @ts-ignore
                            alignItems='center'
                            space='$2'
                            p='$2'
                            backgroundColor='$background'
                            borderRadius='$3'
                          >
                            <Text fontSize='$2' color='$color10'>
                              {wordData.index}
                            </Text>
                            <Text
                              fontSize='$3'
                              fontWeight='500'
                              color='$color12'
                            >
                              {wordData.word}
                            </Text>
                          </XStack>
                        );
                      })}
                    </XStack>
                  ))}
                </YStack>
              </Card>
            </YStack>

            <Separator my='$4' />

            <YStack space='$3'>
              <XStack
                // @ts-ignore
                alignItems='center'
                space='$3'
                onPress={() => {
                  setHasConfirmedReading(!hasConfirmedReading);
                  setShowWarning(false);
                }}
                pressStyle={{ opacity: 0.8 }}
              >
                <Button
                  size='$3'
                  circular
                  variant={hasConfirmedReading ? "outlined" : "outlined"}
                  // @ts-ignore
                  backgroundColor={
                    hasConfirmedReading ? "$green9" : "transparent"
                  }
                  borderColor={hasConfirmedReading ? "$green9" : "$borderColor"}
                  onPress={() => {
                    setHasConfirmedReading(!hasConfirmedReading);
                    setShowWarning(false);
                  }}
                >
                  {hasConfirmedReading && <Text>✓</Text>}
                </Button>
                <Text flex={1} fontSize='$3' color='$color12'>
                  I have written down my recovery phrase and stored it in a safe
                  place
                </Text>
              </XStack>

              {showWarning && (
                <Text color='$red10' fontSize='$3'>
                  Please confirm that you have backed up your recovery phrase
                </Text>
              )}
            </YStack>
          </YStack>
        </ScrollView>

        <YStack space='$3' mt='$4'>
          <Button
            size='$5'
            theme='blue'
            onPress={handleProceedToVerification}
            disabled={!hasConfirmedReading}
            opacity={hasConfirmedReading ? 1 : 0.5}
          >
            <Text fontSize='$5' fontWeight='600'>
              Continue to Verification
            </Text>
          </Button>

          <Text
            // @ts-ignore
            textAlign='center'
            fontSize='$2'
            color='$color10'
          >
            Next: We'll verify you wrote down your phrase correctly
          </Text>
        </YStack>
      </YStack>
    </Modal>
  );
};

export default BackupPhraseModal;
