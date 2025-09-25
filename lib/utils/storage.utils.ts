import * as SecureStore from "expo-secure-store";
import { STORAGE_KEYS, STORAGE_ERRORS } from "../constants/storage.constants";

export const secureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      throw new Error(`${STORAGE_ERRORS.FAILED_TO_STORE}: ${error}`);
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error(`${STORAGE_ERRORS.FAILED_TO_GET}:`, error);
      return null;
    }
  },

  async deleteItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error(`${STORAGE_ERRORS.FAILED_TO_DELETE}:`, error);
      throw error;
    }
  },

  async setJSON<T>(key: string, value: T): Promise<void> {
    await this.setItem(key, JSON.stringify(value));
  },

  async getJSON<T>(key: string): Promise<T | null> {
    const item = await this.getItem(key);
    if (!item) return null;

    try {
      return JSON.parse(item);
    } catch (error) {
      console.error("Failed to parse JSON from storage:", error);
      return null;
    }
  }
};

export const walletStorage = {
  async setWallet(walletInfo: any, privateKey: string): Promise<void> {
    await secureStorage.setJSON(STORAGE_KEYS.WALLET, walletInfo);
    await secureStorage.setItem(STORAGE_KEYS.PRIVATE_KEY, privateKey);
  },

  async getWallet(): Promise<any | null> {
    return await secureStorage.getJSON(STORAGE_KEYS.WALLET);
  },

  async getPrivateKey(): Promise<string | null> {
    return await secureStorage.getItem(STORAGE_KEYS.PRIVATE_KEY);
  },

  async deleteWallet(): Promise<void> {
    await secureStorage.deleteItem(STORAGE_KEYS.WALLET);
    await secureStorage.deleteItem(STORAGE_KEYS.PRIVATE_KEY);
  },

  async setUserId(userId: string): Promise<void> {
    try {
      await secureStorage.setItem(STORAGE_KEYS.USER_ID, userId);
    } catch (error) {
      throw new Error(`${STORAGE_ERRORS.FAILED_TO_STORE_USER_ID}: ${error}`);
    }
  },

  async getUserId(): Promise<string | null> {
    try {
      return await secureStorage.getItem(STORAGE_KEYS.USER_ID);
    } catch (error) {
      console.error(`${STORAGE_ERRORS.FAILED_TO_GET_USER_ID}:`, error);
      return null;
    }
  },

  async setDerivedWallet(
    walletInfo: any,
    privateKey: string,
    salt: string,
    userId: string
  ): Promise<void> {
    await this.setWallet(walletInfo, privateKey);
    await this.setUserId(userId);
  }
};
