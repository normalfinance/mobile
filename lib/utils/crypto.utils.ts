import * as Crypto from 'expo-crypto';
import { Keypair } from '@stellar/stellar-sdk';

export const generateSecureRandomBytes = async (size: number = 32): Promise<Uint8Array> => {
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