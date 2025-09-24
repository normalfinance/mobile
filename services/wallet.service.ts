import * as SecureStore from 'expo-secure-store';
import { Keypair } from '@stellar/stellar-sdk';
import * as Crypto from 'expo-crypto';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface WalletInfo {
  publicKey: string;
  address: string;
}

const WALLET_KEY = 'stellar_wallet';
const PRIVATE_KEY = 'stellar_private_key';

// Core wallet functions
export const createWallet = async (): Promise<WalletInfo> => {
  try {
    // Generate secure random bytes using expo-crypto
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    const keypair = Keypair.fromRawEd25519Seed(Buffer.from(randomBytes));
    
    const walletInfo: WalletInfo = {
      publicKey: keypair.publicKey(),
      address: keypair.publicKey(),
    };

    // Store the wallet securely
    await storeWallet(walletInfo, keypair.secret());
    
    return walletInfo;
  } catch (error) {
    throw new Error(`Failed to create wallet: ${error}`);
  }
};

export const importFromPrivateKey = async (privateKey: string): Promise<WalletInfo> => {
  try {
    // Create keypair from private key
    const keypair = Keypair.fromSecret(privateKey);
    
    const walletInfo: WalletInfo = {
      publicKey: keypair.publicKey(),
      address: keypair.publicKey()
    };

    // Store the imported wallet
    await storeWallet(walletInfo, privateKey);
    
    return walletInfo;
  } catch (error) {
    throw new Error(`Failed to import wallet from private key: ${error}`);
  }
};

export const getWallet = async (): Promise<WalletInfo | null> => {
  try {
    const walletData = await SecureStore.getItemAsync(WALLET_KEY);
    if (!walletData) {
      return null;
    }
    
    return JSON.parse(walletData);
  } catch (error) {
    console.error('Failed to get wallet:', error);
    return null;
  }
};

export const getKeypair = async (): Promise<Keypair | null> => {
  try {
    const privateKey = await SecureStore.getItemAsync(PRIVATE_KEY);
    if (!privateKey) {
      return null;
    }

    return Keypair.fromSecret(privateKey);
  } catch (error) {
    console.error('Failed to get keypair:', error);
    return null;
  }
};

export const hasWallet = async (): Promise<boolean> => {
  try {
    const wallet = await getWallet();
    return wallet !== null;
  } catch {
    return false;
  }
};

export const deleteWallet = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(WALLET_KEY);
    await SecureStore.deleteItemAsync(PRIVATE_KEY);
  } catch (error) {
    console.error('Failed to delete wallet:', error);
    throw error;
  }
};

export const getPrivateKey = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(PRIVATE_KEY);
  } catch (error) {
    console.error('Failed to get private key:', error);
    return null;
  }
};

// Private helper function
const storeWallet = async (walletInfo: WalletInfo, privateKey: string): Promise<void> => {
  try {
    // Store wallet info (public data)
    await SecureStore.setItemAsync(WALLET_KEY, JSON.stringify(walletInfo));
    
    // Store private key separately and securely
    await SecureStore.setItemAsync(PRIVATE_KEY, privateKey);
  } catch (error) {
    throw new Error(`Failed to store wallet: ${error}`);
  }
};

// Query Keys
export const walletQueryKeys = {
  all: ['wallet'] as const,
  info: () => [...walletQueryKeys.all, 'info'] as const,
  keypair: () => [...walletQueryKeys.all, 'keypair'] as const,
  hasWallet: () => [...walletQueryKeys.all, 'hasWallet'] as const,
  privateKey: () => [...walletQueryKeys.all, 'privateKey'] as const,
};

// Custom Hooks
export const useCreateWallet = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createWallet,
    onSuccess: (walletInfo) => {
      // Update all wallet-related queries
      queryClient.setQueryData(walletQueryKeys.info(), walletInfo);
      queryClient.setQueryData(walletQueryKeys.hasWallet(), true);
      queryClient.invalidateQueries({ queryKey: walletQueryKeys.all });
    },
    onError: (error) => {
      console.error('Wallet creation failed:', error);
    }
  });
};

export const useImportWallet = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ privateKey }: { privateKey: string }) => 
      importFromPrivateKey(privateKey),
    onSuccess: (walletInfo) => {
      // Update all wallet-related queries
      queryClient.setQueryData(walletQueryKeys.info(), walletInfo);
      queryClient.setQueryData(walletQueryKeys.hasWallet(), true);
      queryClient.invalidateQueries({ queryKey: walletQueryKeys.all });
    },
    onError: (error) => {
      console.error('Wallet import failed:', error);
    }
  });
};

export const useWallet = () => {
  return useQuery({
    queryKey: walletQueryKeys.info(),
    queryFn: getWallet,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useWalletKeypair = (enabled: boolean = true) => {
  return useQuery({
    queryKey: walletQueryKeys.keypair(),
    queryFn: getKeypair,
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useHasWallet = () => {
  return useQuery({
    queryKey: walletQueryKeys.hasWallet(),
    queryFn: hasWallet,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

export const useDeleteWallet = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteWallet,
    onSuccess: () => {
      // Clear all wallet-related queries
      queryClient.setQueryData(walletQueryKeys.info(), null);
      queryClient.setQueryData(walletQueryKeys.hasWallet(), false);
      queryClient.setQueryData(walletQueryKeys.keypair(), null);
      queryClient.setQueryData(walletQueryKeys.privateKey(), null);
      queryClient.invalidateQueries({ queryKey: walletQueryKeys.all });
    },
    onError: (error) => {
      console.error('Wallet deletion failed:', error);
    }
  });
};

export const usePrivateKey = (enabled: boolean = false) => {
  return useQuery({
    queryKey: walletQueryKeys.privateKey(),
    queryFn: getPrivateKey,
    enabled,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

// Composite hooks for common wallet operations
export const useWalletStatus = () => {
  const walletQuery = useWallet();
  const hasWalletQuery = useHasWallet();
  
  return {
    wallet: walletQuery.data,
    hasWallet: hasWalletQuery.data ?? false,
    isLoading: walletQuery.isLoading || hasWalletQuery.isLoading,
    error: walletQuery.error || hasWalletQuery.error,
    refetch: () => {
      walletQuery.refetch();
      hasWalletQuery.refetch();
    }
  };
};

export const useWalletActions = () => {
  const createMutation = useCreateWallet();
  const importMutation = useImportWallet();
  const deleteMutation = useDeleteWallet();
  
  return {
    createWallet: createMutation.mutate,
    createWalletAsync: createMutation.mutateAsync,
    importWallet: importMutation.mutate,
    importWalletAsync: importMutation.mutateAsync,
    deleteWallet: deleteMutation.mutate,
    deleteWalletAsync: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isImporting: importMutation.isPending,
    isDeleting: deleteMutation.isPending,
    error: createMutation.error || importMutation.error || deleteMutation.error,
  };
};