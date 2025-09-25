import * as Crypto from "expo-crypto";
import { Keypair } from "@stellar/stellar-sdk";
import { pbkdf2 as pbkdf2Noble } from "@noble/hashes/pbkdf2";
import { sha256 } from "@noble/hashes/sha2";

export const generateSecureRandomBytes = async (
  size: number = 32
): Promise<Uint8Array> => {
  return await Crypto.getRandomBytesAsync(size);
};

export const createKeypairFromSeed = async (): Promise<Keypair> => {
  const randomBytes = await generateSecureRandomBytes(32);
  return Keypair.fromRawEd25519Seed(Buffer.from(randomBytes));
};

export const createKeypairFromSecret = (privateKey: string): Keypair => {
  return Keypair.fromSecret(privateKey);
};

export const validatePrivateKey = (privateKey: string): boolean => {
  try {
    Keypair.fromSecret(privateKey);
    return true;
  } catch {
    return false;
  }
};

export const validatePublicKey = (publicKey: string): boolean => {
  try {
    Keypair.fromPublicKey(publicKey);
    return true;
  } catch {
    return false;
  }
};

export const getPublicKeyFromPrivate = (privateKey: string): string => {
  const keypair = createKeypairFromSecret(privateKey);
  return keypair.publicKey();
};

export const generateSalt = async (size: number = 32): Promise<string> => {
  const randomBytes = await generateSecureRandomBytes(size);
  return Buffer.from(randomBytes).toString("hex");
};

export const deriveKeyFromUserData = async (
  userId: string,
  sessionSecret: string,
  salt: string,
  iterations: number = 100000
): Promise<Uint8Array> => {
  console.log("Deriving key from user data:", userId, sessionSecret, salt);
  try {
    const input = `${userId}:${sessionSecret}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const saltBytes = Buffer.from(salt, "hex");

    // const importedKey = await crypto.subtle.importKey(
    //   "raw",
    //   data,
    //   { name: "PBKDF2" },
    //   false,
    //   ["deriveBits"]
    // );
    // console.log("Imported key deriveKeyFromUserData", importedKey);

    // const derivedBits = await crypto.subtle.deriveBits(
    //   {
    //     name: "PBKDF2",
    //     salt: saltBytes,
    //     iterations: iterations,
    //     hash: "SHA-256"
    //   },
    //   importedKey,
    //   256 // 32 bytes * 8 bits
    // );

    const derivedbits = pbkdf2Noble(sha256, data, saltBytes, {
      c: iterations,
      dkLen: 32
    });
    return derivedbits;
  } catch (error) {
    console.error("Error in deriveKeyFromUserData", error);
    throw new Error(`Key derivation failed: ${error}`);
  }
};

export const createKeypairFromDerivedKey = (
  derivedKey: Uint8Array
): Keypair => {
  try {
    return Keypair.fromRawEd25519Seed(Buffer.from(derivedKey));
  } catch (error) {
    throw new Error(`Failed to create keypair from derived key: ${error}`);
  }
};

export const deriveWalletFromUserData = async (
  userId: string,
  sessionSecret: string,
  salt: string
): Promise<{ keypair: Keypair; publicKey: string; address: string }> => {
  try {
    const derivedKey = await deriveKeyFromUserData(userId, sessionSecret, salt);
    console.log("Derived key deriveWalletFromUserData", derivedKey.toString());
    const keypair = createKeypairFromDerivedKey(derivedKey);
    console.log(
      "Derived keypair from derived key from deriveWalletFromUserData",
      keypair.secret(),
      keypair.publicKey()
    );

    return {
      keypair,
      publicKey: keypair.publicKey(),
      address: keypair.publicKey()
    };
  } catch (error) {
    console.error("Error in deriveWalletFromUserData", error);
    throw new Error(`Wallet derivation failed: ${error}`);
  }
};
