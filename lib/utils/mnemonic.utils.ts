import * as bip39 from "bip39";
import { Keypair } from "@stellar/stellar-sdk";
import * as Crypto from "expo-crypto";

export interface MnemonicVerificationWord {
  index: number;
  word: string;
}

export const generateMnemonic = (): string => {
  // Generate entropy using expo-crypto to ensure compatibility
  const entropy = Crypto.getRandomValues(new Uint8Array(32)); // 32 bytes = 256 bits
  const entropyHex = Array.from(entropy, byte => byte.toString(16).padStart(2, '0')).join('');
  return bip39.entropyToMnemonic(entropyHex);
};

export const validateMnemonic = (mnemonic: string): boolean => {
  return bip39.validateMnemonic(mnemonic.trim());
};

export const mnemonicToSeed = async (mnemonic: string, passphrase: string = ""): Promise<Buffer> => {
  return await bip39.mnemonicToSeed(mnemonic.trim(), passphrase);
};

export const mnemonicToSeedSync = (mnemonic: string, passphrase: string = ""): Buffer => {
  return bip39.mnemonicToSeedSync(mnemonic.trim(), passphrase);
};

export const createKeypairFromMnemonic = (mnemonic: string, passphrase: string = ""): Keypair => {
  if (!validateMnemonic(mnemonic)) {
    throw new Error("Invalid mnemonic phrase");
  }
  
  const seed = mnemonicToSeedSync(mnemonic, passphrase);
  // Use first 32 bytes of seed for Ed25519 key generation
  const seedBytes = seed.slice(0, 32);
  
  return Keypair.fromRawEd25519Seed(seedBytes);
};

export const splitMnemonicToWords = (mnemonic: string): string[] => {
  return mnemonic.trim().split(/\s+/);
};

export const wordsToMnemonic = (words: string[]): string => {
  return words.join(" ");
};

export const getRandomVerificationWords = (mnemonic: string, count: number = 2): MnemonicVerificationWord[] => {
  const words = splitMnemonicToWords(mnemonic);
  const indices = new Set<number>();
  
  // Generate unique random indices
  while (indices.size < count) {
    const randomIndex = Math.floor(Math.random() * words.length);
    indices.add(randomIndex);
  }
  
  return Array.from(indices)
    .sort((a, b) => a - b)
    .map(index => ({
      index: index + 1, // 1-indexed for user display
      word: words[index]
    }));
};

export const verifyMnemonicWords = (
  originalMnemonic: string, 
  verificationWords: { index: number; userInput: string }[]
): boolean => {
  const words = splitMnemonicToWords(originalMnemonic);
  
  return verificationWords.every(({ index, userInput }) => {
    const actualWord = words[index - 1]; // Convert back to 0-indexed
    return actualWord.toLowerCase() === userInput.toLowerCase().trim();
  });
};

export const formatMnemonicForDisplay = (mnemonic: string): { word: string; index: number }[] => {
  const words = splitMnemonicToWords(mnemonic);
  return words.map((word, index) => ({
    word,
    index: index + 1
  }));
};

export const isMnemonicComplete = (input: string): boolean => {
  const words = splitMnemonicToWords(input);
  return words.length === 24 && words.every(word => word.length > 0);
};

export const normalizeMnemonic = (input: string): string => {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " "); // Replace multiple spaces with single space
};