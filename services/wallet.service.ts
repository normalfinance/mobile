import { Keypair } from '@stellar/stellar-sdk';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { STORAGE_ERRORS } from '../lib/constants/storage.constants';
import { walletStorage } from '../lib/utils/storage.utils';
import { createKeypairFromSeed, createKeypairFromSecret } from '../lib/utils/crypto.utils';
import { STALE_TIMES } from '../lib/utils/query.utils';

export interface WalletInfo {
  publicKey: string;
  address: string;
}


// Core wallet functions
export const createWallet = async (): Promise<WalletInfo> => {
  try {
    const keypair = await createKeypairFromSeed();
    
    const walletInfo: WalletInfo = {
      publicKey: keypair.publicKey(),
      address: keypair.publicKey(),
    };

    // Store the wallet securely
    await walletStorage.setWallet(walletInfo, keypair.secret());
    
    return walletInfo;
  } catch (error) {
    throw new Error(`Failed to create wallet: ${error}`);
  }
};

export const importFromPrivateKey = async (privateKey: string): Promise<WalletInfo> => {
  try {
    // Create keypair from private key
    const keypair = createKeypairFromSecret(privateKey);
    
    const walletInfo: WalletInfo = {
      publicKey: keypair.publicKey(),
      address: keypair.publicKey()
    };

    // Store the imported wallet
    await walletStorage.setWallet(walletInfo, privateKey);
    
    return walletInfo;
  } catch (error) {
    throw new Error(`Failed to import wallet from private key: ${error}`);
  }
};

export const getWallet = async (): Promise<WalletInfo | null> => {
  return await walletStorage.getWallet();
};

export const getKeypair = async (): Promise<Keypair | null> => {
  try {
    const privateKey = await walletStorage.getPrivateKey();
    if (!privateKey) {
      return null;
    }

    return createKeypairFromSecret(privateKey);
  } catch (error) {
    console.error(STORAGE_ERRORS.FAILED_TO_GET_PRIVATE_KEY, error);
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
  await walletStorage.deleteWallet();
};

export const getPrivateKey = async (): Promise<string | null> => {
  return await walletStorage.getPrivateKey();
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
    staleTime: STALE_TIMES.MEDIUM,
  });
};

export const useWalletKeypair = (enabled: boolean = true) => {
  return useQuery({
    queryKey: walletQueryKeys.keypair(),
    queryFn: getKeypair,
    enabled,
    staleTime: STALE_TIMES.MEDIUM,
  });
};

export const useHasWallet = () => {
  return useQuery({
    queryKey: walletQueryKeys.hasWallet(),
    queryFn: hasWallet,
    staleTime: STALE_TIMES.SHORT,
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
    staleTime: STALE_TIMES.SHORT,
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