import { WalletError } from './wallet-types';

export const formatPublicKey = (publicKey: string): string => {
  if (!publicKey) return '';
  return `${publicKey.substring(0, 8)}...${publicKey.substring(publicKey.length - 8)}`;
};

export const formatFullPublicKey = (publicKey: string): string => {
  if (!publicKey) return '';
  return publicKey;
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};

export const validateMnemonic = (mnemonic: string): boolean => {
  if (!mnemonic || typeof mnemonic !== 'string') {
    return false;
  }
  
  const words = mnemonic.trim().split(/\s+/);
  return words.length === 12 || words.length === 24;
};

export const sanitizeMnemonic = (mnemonic: string): string => {
  return mnemonic
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .join(' ');
};

export const getWalletErrorMessage = (error: string): string => {
  switch (error) {
    case WalletError.INVALID_MNEMONIC:
      return 'Invalid mnemonic phrase. Please check your words and try again.';
    case WalletError.KEYSTORE_ERROR:
      return 'Failed to access secure storage. Please try again.';
    case WalletError.WALLET_ALREADY_EXISTS:
      return 'A wallet already exists for this account.';
    case WalletError.WALLET_NOT_FOUND:
      return 'No wallet found for this account.';
    case WalletError.ENCRYPTION_ERROR:
      return 'Failed to encrypt wallet data. Please try again.';
    case WalletError.DECRYPTION_ERROR:
      return 'Failed to decrypt wallet data. Please try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
};

export const isValidStellarAddress = (address: string): boolean => {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  return address.length === 56 && address.startsWith('G');
};

export const truncateAddress = (address: string, startChars: number = 6, endChars: number = 4): string => {
  if (!address || address.length <= startChars + endChars) {
    return address;
  }
  
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

export const generateWalletId = (userId: string): string => {
  return `wallet_${userId}_${Date.now()}`;
};

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const debounce = <T extends (...args: any[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void => {
  let timeoutId: any;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};