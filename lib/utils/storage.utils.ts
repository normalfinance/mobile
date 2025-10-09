import * as SecureStore from "expo-secure-store";
import { STORAGE_KEYS, STORAGE_ERRORS } from "../constants/storage.constants";

const BIGINT_TAG = "__bigint__";

const serializeForStorage = (value: unknown): string =>
  JSON.stringify(value, (_, v) =>
    typeof v === "bigint" ? { [BIGINT_TAG]: v.toString() } : v
  );

const deserializeFromStorage = <T>(raw: string): T =>
  JSON.parse(raw, (_, v) =>
    v && typeof v === "object" && BIGINT_TAG in v ? BigInt(v[BIGINT_TAG]) : v
  );

const shouldBypassSerialization = (key: string): boolean =>
  key === STORAGE_KEYS.WALLET ||
  key === STORAGE_KEYS.PRIVATE_KEY ||
  key === STORAGE_KEYS.USER_ID;

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
    const payload = shouldBypassSerialization(key)
      ? JSON.stringify(value)
      : serializeForStorage(value);
    await this.setItem(key, payload);
  },

  async getJSON<T>(key: string): Promise<T | null> {
    const item = await this.getItem(key);
    if (!item) return null;

    try {
      return shouldBypassSerialization(key)
        ? JSON.parse(item)
        : deserializeFromStorage<T>(item);
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
    console.log("Deleting wallet from secure storage...");
    await secureStorage.deleteItem(STORAGE_KEYS.WALLET);
    console.log("Deleted wallet info");
    await secureStorage.deleteItem(STORAGE_KEYS.PRIVATE_KEY);
    console.log("Deleted private key");
    await secureStorage.deleteItem(STORAGE_KEYS.USER_ID);
    console.log("Deleted user ID");
    console.log("All wallet data deleted successfully");
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

// Cache management utilities for oracle service
export const cacheStorage = {
  // Get the list of all cache keys
  async getCacheKeysList(): Promise<string[]> {
    try {
      const keys = await secureStorage.getJSON<string[]>(
        STORAGE_KEYS.ORACLE_CACHE_KEYS
      );
      return keys || [];
    } catch (error) {
      console.error("Failed to get cache keys list:", error);
      return [];
    }
  },

  // Update the master list of cache keys
  async updateCacheKeysList(keys: string[]): Promise<void> {
    try {
      await secureStorage.setJSON(STORAGE_KEYS.ORACLE_CACHE_KEYS, keys);
    } catch (error) {
      console.error(`${STORAGE_ERRORS.FAILED_TO_MANAGE_CACHE}:`, error);
      throw error;
    }
  },

  // Add a key to the cache keys list
  async addCacheKey(key: string): Promise<void> {
    try {
      const keys = await this.getCacheKeysList();
      if (!keys.includes(key)) {
        keys.push(key);
        await this.updateCacheKeysList(keys);
      }
    } catch (error) {
      console.error(`${STORAGE_ERRORS.FAILED_TO_MANAGE_CACHE}:`, error);
      throw error;
    }
  },

  // Remove a key from the cache keys list
  async removeCacheKey(key: string): Promise<void> {
    try {
      const keys = await this.getCacheKeysList();
      const filteredKeys = keys.filter((k) => k !== key);
      await this.updateCacheKeysList(filteredKeys);
    } catch (error) {
      console.error(`${STORAGE_ERRORS.FAILED_TO_MANAGE_CACHE}:`, error);
      throw error;
    }
  },

  // Get all keys that start with a specific prefix
  async getKeysWithPrefix(prefix: string): Promise<string[]> {
    try {
      const keys = await this.getCacheKeysList();
      return keys.filter((key) => key.startsWith(prefix));
    } catch (error) {
      console.error("Failed to get keys with prefix:", error);
      return [];
    }
  },

  // Set cache item and track the key
  async setCacheItem<T>(key: string, value: T): Promise<void> {
    try {
      await secureStorage.setJSON(key, value);
      await this.addCacheKey(key);
    } catch (error) {
      console.error("Failed to set cache item:", error);
      throw error;
    }
  },

  // Get cache item
  async getCacheItem<T>(key: string): Promise<T | null> {
    try {
      return await secureStorage.getJSON<T>(key);
    } catch (error) {
      console.error("Failed to get cache item:", error);
      return null;
    }
  },

  // Remove cache item and untrack the key
  async removeCacheItem(key: string): Promise<void> {
    try {
      await secureStorage.deleteItem(key);
      await this.removeCacheKey(key);
    } catch (error) {
      console.error("Failed to remove cache item:", error);
      throw error;
    }
  },

  // Remove multiple cache items
  async multiRemove(keys: string[]): Promise<void> {
    try {
      // Remove all items from secure storage
      const removePromises = keys.map((key) => secureStorage.deleteItem(key));
      await Promise.all(removePromises);

      // Update the cache keys list by removing all the deleted keys
      const currentKeys = await this.getCacheKeysList();
      const remainingKeys = currentKeys.filter((key) => !keys.includes(key));
      await this.updateCacheKeysList(remainingKeys);
    } catch (error) {
      console.error("Failed to remove multiple cache items:", error);
      throw error;
    }
  },

  // Clear all keys with a specific prefix
  async clearKeysWithPrefix(prefix: string): Promise<void> {
    try {
      const keysToRemove = await this.getKeysWithPrefix(prefix);
      if (keysToRemove.length > 0) {
        await this.multiRemove(keysToRemove);
      }
    } catch (error) {
      console.error(`${STORAGE_ERRORS.FAILED_TO_CLEAR_CACHE}:`, error);
      throw error;
    }
  },

  // Get cache statistics
  async getCacheStats(): Promise<{
    totalCachedItems: number;
    keysWithPrefix: (prefix: string) => Promise<number>;
    allKeys: string[];
  }> {
    try {
      const keys = await this.getCacheKeysList();
      return {
        totalCachedItems: keys.length,
        keysWithPrefix: async (prefix: string) => {
          const prefixKeys = await this.getKeysWithPrefix(prefix);
          return prefixKeys.length;
        },
        allKeys: [...keys] // Return a copy
      };
    } catch (error) {
      console.error("Failed to get cache stats:", error);
      return {
        totalCachedItems: 0,
        keysWithPrefix: async () => 0,
        allKeys: []
      };
    }
  },

  // Clear all cache (useful for debugging or reset)
  async clearAllCache(): Promise<void> {
    try {
      const keys = await this.getCacheKeysList();
      if (keys.length > 0) {
        await this.multiRemove(keys);
      }
      // Also clear the keys list itself
      await secureStorage.deleteItem(STORAGE_KEYS.ORACLE_CACHE_KEYS);
    } catch (error) {
      console.error(`${STORAGE_ERRORS.FAILED_TO_CLEAR_CACHE}:`, error);
      throw error;
    }
  }
};
