import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  YStack,
  XStack,
  H3,
  H4,
  Text,
  Button,
  Card,
  Separator,
  ScrollView,
  Input
} from "tamagui";
import {
  validateMnemonic,
  normalizeMnemonic,
  isMnemonicComplete,
  splitMnemonicToWords,
  wordsToMnemonic
} from "@/lib/utils/mnemonic.utils";
import type { TextInput } from "react-native";

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
  const inputRef = useRef<TextInput | null>(null);
  const [words, setWords] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [mnemonicError, setMnemonicError] = useState("");
  const [wordLimitWarning, setWordLimitWarning] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const normalizedWords = useMemo(() => {
    const trimmedInput = inputValue.trim();
    const baseWords = [...words];

    if (editingIndex !== null) {
      if (trimmedInput) {
        baseWords[editingIndex] = trimmedInput.toLowerCase();
      }
      return baseWords;
    }

    const pendingWord = trimmedInput ? trimmedInput.toLowerCase() : null;
    return pendingWord ? [...baseWords, pendingWord] : baseWords;
  }, [words, inputValue, editingIndex]);

  const normalizedMnemonic = useMemo(() => {
    return normalizeMnemonic(wordsToMnemonic(normalizedWords));
  }, [normalizedWords]);

  const wordCount = normalizedWords.length;

  const addWords = useCallback((candidateWords: string[]) => {
    if (!candidateWords.length) {
      return;
    }

    setEditingIndex(null);
    setWords((prevWords) => {
      const sanitized = candidateWords
        .map((word) => word.trim().toLowerCase())
        .filter((word) => word.length > 0);

      if (!sanitized.length) {
        return prevWords;
      }

      const availableSlots = Math.max(0, 24 - prevWords.length);
      if (availableSlots === 0) {
        setWordLimitWarning(true);
        return prevWords;
      }

      const allowedWords = sanitized.slice(0, availableSlots);
      if (allowedWords.length < sanitized.length) {
        setWordLimitWarning(true);
      }

      setMnemonicError("");
      return [...prevWords, ...allowedWords];
    });
  }, []);

  const commitPendingWord = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      if (editingIndex !== null) {
        setEditingIndex(null);
      }
      return;
    }

    if (editingIndex !== null) {
      setWords((prev) => {
        const next = [...prev];
        next[editingIndex] = trimmed.toLowerCase();
        return next;
      });
      setEditingIndex(null);
      setInputValue("");
      return;
    }

    if (words.length >= 24) {
      setWordLimitWarning(true);
      setInputValue("");
      return;
    }

    addWords([trimmed]);
    setInputValue("");
  }, [addWords, editingIndex, inputValue, words.length]);

  const handleWordInputChange = useCallback(
    (text: string) => {
      setWordLimitWarning(false);
      setMnemonicError("");

      if (editingIndex !== null) {
        setInputValue(text.replace(/\s+/g, " "));
        return;
      }

      if (!text.includes(" ")) {
        setInputValue(text.replace(/\s+/g, " "));
        return;
      }

      // Handle pasted phrases and spaces
      const collapsed = text.replace(/\s+/g, " ");
      const endsWithSpace = /\s$/.test(text);
      const parts = collapsed.split(" ");

      const candidateWords = endsWithSpace ? parts : parts.slice(0, -1);
      addWords(candidateWords);

      const remaining = endsWithSpace ? "" : parts[parts.length - 1] ?? "";
      setInputValue(remaining);
    },
    [addWords, editingIndex]
  );

  const handleKeyPress = useCallback(
    ({ nativeEvent }: { nativeEvent: { key: string } }) => {
      if (nativeEvent.key === "Backspace" && inputValue === "") {
        if (editingIndex !== null) {
          setEditingIndex(null);
          setInputValue("");
          return;
        }
        setWordLimitWarning(false);
        setMnemonicError("");
        setWords((prev) => {
          if (!prev.length) {
            return prev;
          }
          const next = [...prev];
          const lastWord = next.pop() ?? "";
          setInputValue(lastWord);
          return next;
        });
      }
    },
    [editingIndex, inputValue]
  );

  const handleChipRemove = useCallback(
    (index: number) => {
      setWordLimitWarning(false);
      setMnemonicError("");
      setWords((prev) => prev.filter((_, idx) => idx !== index));

      if (editingIndex !== null) {
        if (index === editingIndex) {
          setEditingIndex(null);
          setInputValue("");
        } else if (index < editingIndex) {
          setEditingIndex(editingIndex - 1);
        }
      }
    },
    [editingIndex]
  );

  const handleChipEdit = useCallback(
    (index: number) => {
      const wordToEdit = words[index];
      if (!wordToEdit) {
        return;
      }

      setWordLimitWarning(false);
      setMnemonicError("");
      setEditingIndex(index);
      setInputValue(wordToEdit);
      setTimeout(() => {
        inputRef.current?.focus?.();
      }, 0);
    },
    [words]
  );

  const handleImport = () => {
    setWordLimitWarning(false);
    setMnemonicError("");
    const finalWords = normalizedWords;

    if (!finalWords.length) {
      setMnemonicError("Please enter your recovery phrase");
      return;
    }

    if (!isMnemonicComplete(wordsToMnemonic(finalWords))) {
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
    isValidWordCount &&
    normalizeMnemonic(normalizedMnemonic).trim().length > 0 &&
    validateMnemonic(normalizedMnemonic);

  const remainingSlots = Math.max(0, 24 - words.length);

  return (
    <ScrollView flex={1} showsVerticalScrollIndicator={false}>
      <YStack space='$4'>
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
          <YStack
            space='$3'
            borderWidth={1}
            borderColor={
              mnemonicError || error
                ? "$red8"
                : hasValidMnemonic
                ? "$green8"
                : "$borderColor"
            }
            // @ts-ignore
            borderRadius='$4'
            p='$3'
          >
            <XStack flexWrap='wrap' gap='$2'>
              {words.map((word, index) => {
                const isEditing = editingIndex === index;
                return (
                  <XStack
                    key={`${word}-${index}`}
                    // @ts-ignore
                    alignItems='center'
                    backgroundColor={isEditing ? "$blue3" : "$gray3"}
                    borderRadius='$4'
                    py='$1'
                    px='$2'
                    gap='$2'
                    borderWidth={isEditing ? 1 : 0}
                    borderColor={isEditing ? "$blue8" : "transparent"}
                  >
                    {/* @ts-ignore */}
                    <XStack gap='$1' alignItems='center'>
                      <Text fontSize='$2' color='$color10'>
                        {index + 1}.
                      </Text>
                      <Text fontSize='$3' fontWeight='500'>
                        {word}
                      </Text>
                    </XStack>
                    <XStack gap='$1'>
                      <Button
                        size='$2'
                        variant='outlined'
                        onPress={() => handleChipEdit(index)}
                        disabled={isLoading}
                      >
                        <Text fontSize='$2'>Edit</Text>
                      </Button>
                      <Button
                        size='$2'
                        variant='outlined'
                        onPress={() => handleChipRemove(index)}
                        disabled={isLoading}
                      >
                        <Text fontSize='$2'>×</Text>
                      </Button>
                    </XStack>
                  </XStack>
                );
              })}
            </XStack>

            {(editingIndex !== null || words.length < 24) && (
              <Input
                ref={inputRef}
                size='$4'
                placeholder={
                  editingIndex !== null
                    ? `Edit word #${editingIndex + 1}`
                    : words.length === 0
                    ? "Type or paste your recovery words..."
                    : `Word #${words.length + 1}`
                }
                value={inputValue}
                onChangeText={handleWordInputChange}
                onSubmitEditing={commitPendingWord}
                onBlur={commitPendingWord}
                onKeyPress={handleKeyPress}
                autoCapitalize='none'
                autoCorrect={false}
                autoComplete='off'
                width='100%'
                // @ts-ignore
                alignSelf='stretch'
                backgroundColor='$background'
                borderColor='$borderColor'
                borderWidth={1}
                borderRadius='$4'
                px='$3'
                py='$3'
                mt='$3'
              />
            )}

            {wordLimitWarning && (
              <Text color='$yellow10' fontSize='$3'>
                Recovery phrase accepts exactly 24 words. Remove a word before
                adding more.
              </Text>
            )}
          </YStack>

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

          {remainingSlots > 0 && !mnemonicError && !wordLimitWarning && (
            <Text fontSize='$3' color='$color10'>
              {remainingSlots} more {remainingSlots === 1 ? "word" : "words"}{" "}
              needed to complete your phrase.
            </Text>
          )}
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
        </YStack>
      </YStack>
    </ScrollView>
  );
};

export default ImportMnemonicForm;
