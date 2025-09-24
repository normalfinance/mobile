import * as SecureStore from 'expo-secure-store';
import { Keypair } from '@stellar/stellar-sdk';
import { WalletKeystore, WalletError } from './wallet-types';

class SimpleKeystore {
  async storeWalletKeys(userId: string, keypair: Keypair, mnemonic?: string): Promise<WalletKeystore> {
    console.log('Storing wallet keys for user:', userId);
    
    try {
      const walletData = {
        privateKey: keypair.secret(),
        publicKey: keypair.publicKey(),
        mnemonic: mnemonic || undefined,
        userId,
        createdAt: new Date().toISOString(),
      };

      await SecureStore.setItemAsync(`wallet_${userId}`, JSON.stringify(walletData));

      console.log('Wallet keys stored successfully for user:', userId);

      return {
        publicKey: keypair.publicKey(),
        encryptedPrivateKey: keypair.secret(),
        mnemonic: mnemonic,
      };
    } catch (error) {
      console.error('Error storing wallet keys:', error);
      throw new Error(WalletError.KEYSTORE_ERROR);
    }
  }

  async getWalletKeys(userId: string): Promise<WalletKeystore | null> {
    console.log('Retrieving wallet keys for user:', userId);
    
    try {
      const walletDataStr = await SecureStore.getItemAsync(`wallet_${userId}`);
      
      if (!walletDataStr) {
        console.log('No wallet data found for user:', userId);
        return null;
      }

      const walletData = JSON.parse(walletDataStr);

      console.log('Wallet keys retrieved successfully for user:', userId);

      return {
        publicKey: walletData.publicKey,
        encryptedPrivateKey: walletData.privateKey,
        mnemonic: walletData.mnemonic || undefined,
      };
    } catch (error) {
      console.error('Error retrieving wallet keys:', error);
      return null;
    }
  }

  async getPrivateKey(userId: string): Promise<string | null> {
    console.log('Getting private key for user:', userId);
    
    try {
      const walletDataStr = await SecureStore.getItemAsync(`wallet_${userId}`);
      
      if (!walletDataStr) {
        return null;
      }

      const walletData = JSON.parse(walletDataStr);
      return walletData.privateKey;
    } catch (error) {
      console.error('Error getting private key:', error);
      return null;
    }
  }

  async hasWallet(userId: string): Promise<boolean> {
    console.log('Checking if wallet exists for user:', userId);
    
    try {
      const walletDataStr = await SecureStore.getItemAsync(`wallet_${userId}`);
      const hasWallet = walletDataStr !== null;
      console.log('Wallet exists:', hasWallet, 'for user:', userId);
      return hasWallet;
    } catch (error) {
      console.error('Error checking wallet existence:', error);
      return false;
    }
  }

  async getPublicKey(userId: string): Promise<string | null> {
    console.log('Getting public key for user:', userId);
    
    try {
      const walletDataStr = await SecureStore.getItemAsync(`wallet_${userId}`);
      
      if (!walletDataStr) {
        return null;
      }

      const walletData = JSON.parse(walletDataStr);
      return walletData.publicKey || null;
    } catch (error) {
      console.error('Error getting public key:', error);
      return null;
    }
  }

  async deleteWallet(userId: string): Promise<boolean> {
    console.log('Deleting wallet for user:', userId);
    
    try {
      await SecureStore.deleteItemAsync(`wallet_${userId}`);
      
      console.log('Wallet deleted successfully for user:', userId);
      return true;
    } catch (error) {
      console.error('Error deleting wallet:', error);
      return false;
    }
  }
}

export const simpleKeystore = new SimpleKeystore();