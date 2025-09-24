import * as SecureStore from 'expo-secure-store';
import { Keypair } from '@stellar/stellar-sdk';
import * as Crypto from 'expo-crypto';

export interface WalletInfo {
  publicKey: string;
  address: string;
}

export class WalletService {
  private static readonly WALLET_KEY = 'stellar_wallet';
  private static readonly PRIVATE_KEY = 'stellar_private_key';

  /**
   * Create a new Stellar wallet using secure random generation
   * Using the approach recommended by Stellar SDK docs for React Native
   */
  static async createWallet(): Promise<WalletInfo> {
    try {
      // Generate secure random bytes using expo-crypto
      const randomBytes = await Crypto.getRandomBytesAsync(32);
      const keypair = Keypair.fromRawEd25519Seed(Buffer.from(randomBytes));
      
      const walletInfo: WalletInfo = {
        publicKey: keypair.publicKey(),
        address: keypair.publicKey(),
      };

      // Store the wallet securely
      await this.storeWallet(walletInfo, keypair.secret());
      
      return walletInfo;
    } catch (error) {
      throw new Error(`Failed to create wallet: ${error}`);
    }
  }

  /**
   * Import wallet from private key
   */
  static async importFromPrivateKey(privateKey: string): Promise<WalletInfo> {
    try {
      // Create keypair from private key
      const keypair = Keypair.fromSecret(privateKey);
      
      const walletInfo: WalletInfo = {
        publicKey: keypair.publicKey(),
        address: keypair.publicKey()
      };

      // Store the imported wallet
      await this.storeWallet(walletInfo, privateKey);
      
      return walletInfo;
    } catch (error) {
      throw new Error(`Failed to import wallet from private key: ${error}`);
    }
  }

  /**
   * Get stored wallet information
   */
  static async getWallet(): Promise<WalletInfo | null> {
    try {
      const walletData = await SecureStore.getItemAsync(this.WALLET_KEY);
      if (!walletData) {
        return null;
      }
      
      return JSON.parse(walletData);
    } catch (error) {
      console.error('Failed to get wallet:', error);
      return null;
    }
  }

  /**
   * Get the keypair for signing transactions
   */
  static async getKeypair(): Promise<Keypair | null> {
    try {
      const privateKey = await SecureStore.getItemAsync(this.PRIVATE_KEY);
      if (!privateKey) {
        return null;
      }

      return Keypair.fromSecret(privateKey);
    } catch (error) {
      console.error('Failed to get keypair:', error);
      return null;
    }
  }

  /**
   * Check if wallet exists
   */
  static async hasWallet(): Promise<boolean> {
    try {
      const wallet = await this.getWallet();
      return wallet !== null;
    } catch {
      return false;
    }
  }

  /**
   * Delete wallet (logout)
   */
  static async deleteWallet(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(this.WALLET_KEY);
      await SecureStore.deleteItemAsync(this.PRIVATE_KEY);
    } catch (error) {
      console.error('Failed to delete wallet:', error);
      throw error;
    }
  }

  /**
   * Get the private key for backup purposes
   */
  static async getPrivateKey(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(this.PRIVATE_KEY);
    } catch (error) {
      console.error('Failed to get private key:', error);
      return null;
    }
  }

  /**
   * Store wallet information securely
   */
  private static async storeWallet(walletInfo: WalletInfo, privateKey: string): Promise<void> {
    try {
      // Store wallet info (public data)
      await SecureStore.setItemAsync(this.WALLET_KEY, JSON.stringify(walletInfo));
      
      // Store private key separately and securely
      await SecureStore.setItemAsync(this.PRIVATE_KEY, privateKey);
    } catch (error) {
      throw new Error(`Failed to store wallet: ${error}`);
    }
  }
}