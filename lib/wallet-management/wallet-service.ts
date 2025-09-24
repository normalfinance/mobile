import { Keypair } from "@stellar/stellar-sdk";
import StellarHDWallet from "stellar-hd-wallet";
import { stellarKeystore } from "./stellar-keystore";
import {
  WalletInfo,
  CreateWalletParams,
  ImportWalletParams,
  WalletOperationResult,
  WalletExistsResult,
  MockWalletDbEntry,
  WalletError
} from "./wallet-types";

let mockWalletDatabase: MockWalletDbEntry[] = [];

class WalletService {
  async checkWalletExists(userId: string): Promise<WalletExistsResult> {
    console.log("Checking wallet existence for user:", userId);

    try {
      const hasWallet = await stellarKeystore.hasWallet(userId);

      if (hasWallet) {
        const publicKey = await stellarKeystore.getPublicKey(userId);
        console.log(
          "Wallet exists for user:",
          userId,
          "with public key:",
          publicKey
        );
        return {
          exists: true,
          publicKey: publicKey || undefined
        };
      }

      const mockEntry = mockWalletDatabase.find(
        (entry) => entry.userId === userId
      );
      if (mockEntry) {
        console.log("Found wallet in mock database for user:", userId);
        return {
          exists: true,
          publicKey: mockEntry.publicKey
        };
      }

      console.log("No wallet found for user:", userId);
      return { exists: false };
    } catch (error) {
      console.error("Error checking wallet existence:", error);
      return { exists: false };
    }
  }

  async createWallet(
    params: CreateWalletParams
  ): Promise<WalletOperationResult> {
    console.log("Creating wallet for user:", params.userId);

    try {
      const existingWallet = await this.checkWalletExists(params.userId);
      if (existingWallet.exists) {
        console.log("Wallet already exists for user:", params.userId);
        return {
          success: false,
          error: WalletError.WALLET_ALREADY_EXISTS
        };
      }

      const mnemonic = params.mnemonic || StellarHDWallet.generateMnemonic();
      console.log("Generated mnemonic for user:", params.userId);

      const seed = StellarHDWallet.fromMnemonic(mnemonic);
      const keypair = seed.getKeypair(0);

      console.log(
        "Created keypair for user:",
        params.userId,
        "with public key:",
        keypair.publicKey()
      );

      await stellarKeystore.storeWalletKeys(params.userId, keypair, mnemonic);

      const mockEntry: MockWalletDbEntry = {
        userId: params.userId,
        publicKey: keypair.publicKey(),
        createdAt: new Date(),
        isImported: !!params.mnemonic
      };
      mockWalletDatabase.push(mockEntry);

      console.log("Wallet created successfully for user:", params.userId);
      console.log(
        "Mock database now contains:",
        mockWalletDatabase.length,
        "entries"
      );

      return {
        success: true,
        publicKey: keypair.publicKey()
      };
    } catch (error) {
      console.error("Error creating wallet:", error);
      return {
        success: false,
        error: WalletError.KEYSTORE_ERROR
      };
    }
  }

  async importWallet(
    params: ImportWalletParams
  ): Promise<WalletOperationResult> {
    console.log("Importing wallet for user:", params.userId);

    try {
      const existingWallet = await this.checkWalletExists(params.userId);
      if (existingWallet.exists) {
        console.log("Wallet already exists for user:", params.userId);
        return {
          success: false,
          error: WalletError.WALLET_ALREADY_EXISTS
        };
      }

      if (!this.validateMnemonic(params.mnemonic)) {
        console.log("Invalid mnemonic provided for user:", params.userId);
        return {
          success: false,
          error: WalletError.INVALID_MNEMONIC
        };
      }

      const seed = StellarHDWallet.fromMnemonic(params.mnemonic);
      const keypair = seed.getKeypair(0);
      

      console.log(
        "Created keypair from mnemonic for user:",
        params.userId,
        "with public key:",
        keypair.publicKey()
      );

      await stellarKeystore.storeWalletKeys(
        params.userId,
        keypair,
        params.mnemonic
      );

      const mockEntry: MockWalletDbEntry = {
        userId: params.userId,
        publicKey: keypair.publicKey(),
        createdAt: new Date(),
        isImported: true
      };
      mockWalletDatabase.push(mockEntry);

      console.log("Wallet imported successfully for user:", params.userId);
      console.log(
        "Mock database now contains:",
        mockWalletDatabase.length,
        "entries"
      );

      return {
        success: true,
        publicKey: keypair.publicKey()
      };
    } catch (error) {
      console.error("Error importing wallet:", error);
      return {
        success: false,
        error: WalletError.KEYSTORE_ERROR
      };
    }
  }

  async getWalletInfo(userId: string): Promise<WalletInfo | null> {
    console.log("Getting wallet info for user:", userId);

    try {
      const publicKey = await stellarKeystore.getPublicKey(userId);
      if (!publicKey) {
        console.log("No wallet found for user:", userId);
        return null;
      }

      const mockEntry = mockWalletDatabase.find(
        (entry) => entry.userId === userId
      );

      return {
        publicKey,
        userId,
        createdAt: mockEntry?.createdAt || new Date(),
        isImported: mockEntry?.isImported || false
      };
    } catch (error) {
      console.error("Error getting wallet info:", error);
      return null;
    }
  }

  async deleteWallet(userId: string): Promise<boolean> {
    console.log("Deleting wallet for user:", userId);

    try {
      const success = await stellarKeystore.deleteWallet(userId);

      if (success) {
        mockWalletDatabase = mockWalletDatabase.filter(
          (entry) => entry.userId !== userId
        );
        console.log("Wallet deleted successfully for user:", userId);
        console.log(
          "Mock database now contains:",
          mockWalletDatabase.length,
          "entries"
        );
      }

      return success;
    } catch (error) {
      console.error("Error deleting wallet:", error);
      return false;
    }
  }

  private validateMnemonic(mnemonic: string): boolean {
    const words = mnemonic.trim().split(/\s+/);
    return words.length === 12 || words.length === 24;
  }

  getMockDatabase(): MockWalletDbEntry[] {
    return [...mockWalletDatabase];
  }

  clearMockDatabase(): void {
    console.log("Clearing mock database");
    mockWalletDatabase = [];
  }
}

export const walletService = new WalletService();
