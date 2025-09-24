export interface WalletInfo {
  publicKey: string;
  userId: string;
  createdAt: Date;
  isImported: boolean;
}

export interface CreateWalletParams {
  userId: string;
  mnemonic?: string;
}

export interface ImportWalletParams {
  userId: string;
  mnemonic: string;
}

export interface WalletKeystore {
  publicKey: string;
  encryptedPrivateKey: string;
  mnemonic?: string;
}

export interface WalletOperationResult {
  success: boolean;
  publicKey?: string;
  error?: string;
}

export interface WalletExistsResult {
  exists: boolean;
  publicKey?: string;
}

export interface MockWalletDbEntry {
  userId: string;
  publicKey: string;
  createdAt: Date;
  isImported: boolean;
}

export enum WalletError {
  INVALID_MNEMONIC = 'INVALID_MNEMONIC',
  KEYSTORE_ERROR = 'KEYSTORE_ERROR',
  WALLET_ALREADY_EXISTS = 'WALLET_ALREADY_EXISTS',
  WALLET_NOT_FOUND = 'WALLET_NOT_FOUND',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  DECRYPTION_ERROR = 'DECRYPTION_ERROR'
}