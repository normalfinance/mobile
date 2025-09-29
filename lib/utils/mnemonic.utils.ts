import * as bip39 from "bip39";
import { Keypair } from "@stellar/stellar-sdk";
import * as Crypto from "expo-crypto";
import { hmac } from "@noble/hashes/hmac";
import { sha512 } from "@noble/hashes/sha2";
import { utf8ToBytes } from "@noble/hashes/utils";

export interface MnemonicVerificationWord {
  index: number;
  word: string;
}

export const generateMnemonic = (): string => {
  // Generate entropy using expo-crypto to ensure compatibility
  const entropy = Crypto.getRandomValues(new Uint8Array(32)); // 32 bytes = 256 bits
  const entropyHex = Array.from(entropy, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return bip39.entropyToMnemonic(entropyHex);
};

export const validateMnemonic = (mnemonic: string): boolean => {
  return bip39.validateMnemonic(mnemonic.trim());
};

export const mnemonicToSeed = async (
  mnemonic: string,
  passphrase: string = ""
): Promise<Buffer> => {
  return await bip39.mnemonicToSeed(mnemonic.trim(), passphrase);
};

export const mnemonicToSeedSync = (
  mnemonic: string,
  passphrase: string = ""
): Buffer => {
  return bip39.mnemonicToSeedSync(mnemonic.trim(), passphrase);
};

const ED25519_CURVE = "ed25519 seed";
const HARDENED_OFFSET = 0x80000000;
const STELLAR_BASE_PATH = [44, 148];

const getMasterKeyFromSeed = (seed: Uint8Array) => {
  const digest = hmac(sha512, utf8ToBytes(ED25519_CURVE), seed);
  return {
    key: digest.slice(0, 32),
    chainCode: digest.slice(32)
  };
};

const deriveHardenedChild = (
  key: Uint8Array,
  chainCode: Uint8Array,
  index: number
) => {
  const indexBuffer = new Uint8Array(4);
  new DataView(indexBuffer.buffer).setUint32(0, index + HARDENED_OFFSET);

  const data = new Uint8Array(1 + key.length + indexBuffer.length);
  data.set([0]);
  data.set(key, 1);
  data.set(indexBuffer, 1 + key.length);

  const digest = hmac(sha512, chainCode, data);
  return {
    key: digest.slice(0, 32),
    chainCode: digest.slice(32)
  };
};

const deriveStellarAccountRawSeed = (
  seed: Uint8Array,
  accountIndex: number
) => {
  if (!Number.isInteger(accountIndex) || accountIndex < 0) {
    throw new Error("Account index must be a non-negative integer");
  }

  let { key, chainCode } = getMasterKeyFromSeed(seed);

  for (const segment of [...STELLAR_BASE_PATH, accountIndex]) {
    ({ key, chainCode } = deriveHardenedChild(key, chainCode, segment));
  }

  return key;
};

export const createKeypairFromMnemonic = (
  mnemonic: string,
  passphrase: string = "",
  accountIndex: number = 0
): Keypair => {
  if (!validateMnemonic(mnemonic)) {
    throw new Error("Invalid mnemonic phrase");
  }

  const seedBuffer = mnemonicToSeedSync(
    normalizeMnemonic(mnemonic),
    passphrase
  );
  const seedBytes =
    seedBuffer instanceof Uint8Array ? seedBuffer : new Uint8Array(seedBuffer);
  const rawSeed = deriveStellarAccountRawSeed(seedBytes, accountIndex);

  return Keypair.fromRawEd25519Seed(Buffer.from(rawSeed));
};

export const splitMnemonicToWords = (mnemonic: string): string[] => {
  return mnemonic.trim().split(/\s+/);
};

export const wordsToMnemonic = (words: string[]): string => {
  return words.join(" ");
};

export const getRandomVerificationWords = (
  mnemonic: string,
  count: number = 2
): MnemonicVerificationWord[] => {
  const words = splitMnemonicToWords(mnemonic);
  const indices = new Set<number>();

  // Generate unique random indices
  while (indices.size < count) {
    const randomIndex = Math.floor(Math.random() * words.length);
    indices.add(randomIndex);
  }

  return Array.from(indices)
    .sort((a, b) => a - b)
    .map((index) => ({
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

export const formatMnemonicForDisplay = (
  mnemonic: string
): { word: string; index: number }[] => {
  const words = splitMnemonicToWords(mnemonic);
  return words.map((word, index) => ({
    word,
    index: index + 1
  }));
};

export const isMnemonicComplete = (input: string): boolean => {
  const words = splitMnemonicToWords(input);
  return (
    (words.length === 12 || words.length === 24) &&
    words.every((word) => word.length > 0)
  );
};

export const normalizeMnemonic = (input: string): string => {
  return input.trim().toLowerCase().replace(/\s+/g, " "); // Replace multiple spaces with single space
};
