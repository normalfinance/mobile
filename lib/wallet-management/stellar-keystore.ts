import * as SecureStore from "expo-secure-store";
import { Keypair } from "@stellar/stellar-sdk";
import {
  KeyManager,
  KeyType,
  MemoryKeyStore
} from "@stellar/typescript-wallet-sdk-km";
import { WalletKeystore, WalletError } from "./wallet-types";

class StellarKeystore {
  private keyManager: KeyManager;

  constructor() {
    console.log("Initializing StellarKeystore");
    this.keyManager = new KeyManager({
      keyStore: new MemoryKeyStore()
    });
  }

  private async handleEncryptionKey(keyId: string): Promise<string> {
    console.log("Providing encryption key for keyId:", keyId);
    const encryptionKey = await SecureStore.getItemAsync(
      `encryption_key_${keyId}`
    );
    if (!encryptionKey) {
      const newKey = this.generateEncryptionKey();
      await SecureStore.setItemAsync(`encryption_key_${keyId}`, newKey);
      return newKey;
    }
    return encryptionKey;
  }

  private generateEncryptionKey(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
      ""
    );
  }

  async storeWalletKeys(
    userId: string,
    keypair: Keypair,
    mnemonic?: string
  ): Promise<WalletKeystore> {
    console.log("Storing wallet keys for user:", userId);

    try {
      const keyId = `stellar_wallet_${userId}`;

      const keyData = {
        privateKey: keypair.secret(),
        publicKey: keypair.publicKey(),
        mnemonic: mnemonic || undefined,
        userId,
        createdAt: new Date().toISOString()
      };

      await this.keyManager.storeKey({
        key: {
          id: keyId,
          type: KeyType.plaintextKey,
          privateKey: keypair.secret(),
          publicKey: keypair.publicKey()
        },
        password: await this.getUserPassword(userId),
        encrypterName: "aes-256-gcm"
      });

      if (mnemonic) {
        await SecureStore.setItemAsync(`mnemonic_${userId}`, mnemonic);
      }

      await SecureStore.setItemAsync(
        `wallet_metadata_${userId}`,
        JSON.stringify({
          publicKey: keypair.publicKey(),
          createdAt: keyData.createdAt,
          hasWallet: true
        })
      );

      console.log("Wallet keys stored successfully for user:", userId);

      return {
        publicKey: keypair.publicKey(),
        encryptedPrivateKey: "encrypted",
        mnemonic: mnemonic
      };
    } catch (error) {
      console.error("Error storing wallet keys:", error);
      throw new Error(WalletError.KEYSTORE_ERROR);
    }
  }

  async getWalletKeys(userId: string): Promise<WalletKeystore | null> {
    console.log("Retrieving wallet keys for user:", userId);

    try {
      const keyId = `stellar_wallet_${userId}`;
      const metadata = await SecureStore.getItemAsync(
        `wallet_metadata_${userId}`
      );

      if (!metadata) {
        console.log("No wallet metadata found for user:", userId);
        return null;
      }

      const parsedMetadata = JSON.parse(metadata);

      const keyData = await this.keyManager.loadKey(
        keyId,
        await this.getUserPassword(userId)
      );

      const mnemonic = await SecureStore.getItemAsync(`mnemonic_${userId}`);

      console.log("Wallet keys retrieved successfully for user:", userId);

      return {
        publicKey: keyData.publicKey,
        encryptedPrivateKey: keyData.privateKey,
        mnemonic: mnemonic || undefined
      };
    } catch (error) {
      console.error("Error retrieving wallet keys:", error);
      return null;
    }
  }

  async getPrivateKey(userId: string): Promise<string | null> {
    console.log("Getting private key for user:", userId);

    try {
      const keyId = `stellar_wallet_${userId}`;
      const keyData = await this.keyManager.loadKey(
        keyId,
        await this.getUserPassword(userId)
      );

      return keyData.privateKey;
    } catch (error) {
      console.error("Error getting private key:", error);
      return null;
    }
  }

  async hasWallet(userId: string): Promise<boolean> {
    console.log("Checking if wallet exists for user:", userId);

    try {
      const metadata = await SecureStore.getItemAsync(
        `wallet_metadata_${userId}`
      );
      const hasWallet = metadata !== null;
      console.log("Wallet exists:", hasWallet, "for user:", userId);
      return hasWallet;
    } catch (error) {
      console.error("Error checking wallet existence:", error);
      return false;
    }
  }

  async getPublicKey(userId: string): Promise<string | null> {
    console.log("Getting public key for user:", userId);

    try {
      const metadata = await SecureStore.getItemAsync(
        `wallet_metadata_${userId}`
      );
      if (!metadata) {
        return null;
      }

      const parsedMetadata = JSON.parse(metadata);
      return parsedMetadata.publicKey || null;
    } catch (error) {
      console.error("Error getting public key:", error);
      return null;
    }
  }

  async deleteWallet(userId: string): Promise<boolean> {
    console.log("Deleting wallet for user:", userId);

    try {
      const keyId = `stellar_wallet_${userId}`;

      await this.keyManager.removeKey(keyId);
      await SecureStore.deleteItemAsync(`wallet_metadata_${userId}`);
      await SecureStore.deleteItemAsync(`mnemonic_${userId}`);
      await SecureStore.deleteItemAsync(`encryption_key_${keyId}`);

      console.log("Wallet deleted successfully for user:", userId);
      return true;
    } catch (error) {
      console.error("Error deleting wallet:", error);
      return false;
    }
  }

  private async getUserPassword(userId: string): Promise<string> {
    let password = await SecureStore.getItemAsync(`user_password_${userId}`);
    if (!password) {
      password = this.generateEncryptionKey();
      await SecureStore.setItemAsync(`user_password_${userId}`, password);
    }
    return password;
  }
}

export const stellarKeystore = new StellarKeystore();
