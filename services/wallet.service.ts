import { Keypair } from "@stellar/stellar-sdk";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STORAGE_ERRORS } from "../lib/constants/storage.constants";
import { walletStorage } from "../lib/utils/storage.utils";
import {
  createKeypairFromSeed,
  createKeypairFromSecret,
  deriveWalletFromUserData,
  generateSalt,
  createWalletFromMnemonic,
  generateWalletWithMnemonic
} from "../lib/utils/crypto.utils";
import {
  validateMnemonic,
  normalizeMnemonic
} from "../lib/utils/mnemonic.utils";
import { STALE_TIMES } from "../lib/utils/query.utils";
import {
  getAuthCredentials,
  requireAuth,
  type AuthCredentials
} from "./auth.service";

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
      address: keypair.publicKey()
    };

    // Store the wallet securely
    await walletStorage.setWallet(walletInfo, keypair.secret());

    return walletInfo;
  } catch (error) {
    throw new Error(`Failed to create wallet: ${error}`);
  }
};

export const importFromPrivateKey = async (
  privateKey: string
): Promise<WalletInfo> => {
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

export const createWalletWithMnemonic = async (): Promise<
  WalletInfo & { mnemonic: string }
> => {
  try {
    const walletData = generateWalletWithMnemonic();

    const walletInfo: WalletInfo = {
      publicKey: walletData.publicKey,
      address: walletData.address
    };

    // Store the wallet securely
    await walletStorage.setWallet(walletInfo, walletData.keypair.secret());

    return {
      ...walletInfo,
      mnemonic: walletData.mnemonic
    };
  } catch (error) {
    throw new Error(`Failed to create wallet with mnemonic: ${error}`);
  }
};

export const importFromMnemonic = async (
  mnemonic: string,
  passphrase: string = ""
): Promise<WalletInfo> => {
  try {
    const normalizedMnemonic = normalizeMnemonic(mnemonic);

    if (!validateMnemonic(normalizedMnemonic)) {
      throw new Error("Invalid mnemonic phrase");
    }

    const walletData = createWalletFromMnemonic(normalizedMnemonic, passphrase);

    const walletInfo: WalletInfo = {
      publicKey: walletData.publicKey,
      address: walletData.address
    };

    // Store the imported wallet
    await walletStorage.setWallet(walletInfo, walletData.keypair.secret());

    return walletInfo;
  } catch (error) {
    throw new Error(`Failed to import wallet from mnemonic: ${error}`);
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

export const checkWalletExists = async (
  authCredentials?: AuthCredentials
): Promise<{ exists: boolean; wallet?: WalletInfo }> => {
  try {
    console.log("Checking wallet exists");
    // Get auth credentials if not provided
    const credentials = authCredentials || requireAuth();
    console.log("Credentials", credentials);
    const { userId, sessionSecret } = credentials;

    // First check if wallet exists locally
    const localWallet = await getWallet();
    console.log("Local wallet", localWallet);
    if (localWallet) {
      return { exists: true, wallet: localWallet };
    }

    let backendResult = {
      exists: false,
      walletData: {} as any
    };

    // backendResult = await checkWallet(userId);

    //override backendResult with a mock wallet as if it was returned from the backend
    // backendResult.exists = true;
    // backendResult.walletData = {
    //   publicKey: "GA6PTKEEVZ4GFH2OVAUOFNK57VJHJ2O7IGZFXQHFNV4FI24PWEZHUP6U",
    //   address: "GA6PTKEEVZ4GFH2OVAUOFNK57VJHJ2O7IGZFXQHFNV4FI24PWEZHUP6U",
    //   salt: "a4f7c91e2b56d83f"
    // };

    //override backendResult with a mock wallet as if it was returned from the backend - this time wallet does not exist
    backendResult.exists = false;

    if (backendResult.exists && backendResult.walletData) {
      // Wallet exists in backend, derive it locally
      const salt = backendResult.walletData.salt || "test-salt-from-mock";

      if (!salt) {
        throw new Error("Salt not found in backend wallet data");
      }

      const derivedWallet = await deriveWalletFromUserData(
        userId,
        sessionSecret,
        salt
      );

      console.log("Derived wallet from user data", derivedWallet);

      // Verify the derived public key matches the backend
      if (derivedWallet.publicKey !== backendResult.walletData.publicKey) {
        throw new Error("Derived wallet does not match backend wallet");
      }

      // Store the derived wallet locally
      await walletStorage.setDerivedWallet(
        { publicKey: derivedWallet.publicKey, address: derivedWallet.address },
        derivedWallet.keypair.secret(),
        salt,
        userId
      );

      console.log("Derived wallet stored LOCALLY", derivedWallet);

      return {
        exists: true,
        wallet: {
          publicKey: derivedWallet.publicKey,
          address: derivedWallet.address
        }
      };
    }

    return { exists: false };
  } catch (error) {
    console.error("Wallet existence check failed:", error);
    return { exists: false };
  }
};

export const createDeterministicWallet = async (
  authCredentials?: AuthCredentials
): Promise<WalletInfo> => {
  try {
    // Get auth credentials if not provided
    const credentials = authCredentials || requireAuth();
    const { userId, sessionSecret } = credentials;

    // Generate a new salt for this user
    const salt = await generateSalt();

    // Derive wallet from user data (email + session ID)
    const derivedWallet = await deriveWalletFromUserData(
      userId,
      sessionSecret,
      salt
    );

    const walletInfo: WalletInfo = {
      publicKey: derivedWallet.publicKey,
      address: derivedWallet.address
    };

    // Store the wallet with all necessary data
    await walletStorage.setDerivedWallet(
      walletInfo,
      derivedWallet.keypair.secret(),
      salt,
      userId
    );

    return walletInfo;
  } catch (error) {
    throw new Error(`Failed to create deterministic wallet: ${error}`);
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

export const hasWalletWithBackendCheck = async (
  authCredentials?: AuthCredentials
): Promise<boolean> => {
  try {
    const result = await checkWalletExists(authCredentials);
    return result.exists;
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
  all: ["wallet"] as const,
  info: () => [...walletQueryKeys.all, "info"] as const,
  keypair: () => [...walletQueryKeys.all, "keypair"] as const,
  hasWallet: () => [...walletQueryKeys.all, "hasWallet"] as const,
  privateKey: () => [...walletQueryKeys.all, "privateKey"] as const,
  checkExists: (userId: string) =>
    [...walletQueryKeys.all, "checkExists", userId] as const,
  hasWalletBackend: (userId: string) =>
    [...walletQueryKeys.all, "hasWalletBackend", userId] as const
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
      console.error("Wallet creation failed:", error);
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
      console.error("Wallet import failed:", error);
    }
  });
};

export const useCreateWalletWithMnemonic = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createWalletWithMnemonic,
    onSuccess: (walletInfo) => {
      // Update all wallet-related queries
      const { mnemonic, ...wallet } = walletInfo;
      queryClient.setQueryData(walletQueryKeys.info(), wallet);
      queryClient.setQueryData(walletQueryKeys.hasWallet(), true);
      queryClient.invalidateQueries({ queryKey: walletQueryKeys.all });
    },
    onError: (error) => {
      console.error("Wallet creation with mnemonic failed:", error);
    }
  });
};

export const useImportFromMnemonic = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      mnemonic,
      passphrase
    }: {
      mnemonic: string;
      passphrase?: string;
    }) => importFromMnemonic(mnemonic, passphrase),
    onSuccess: (walletInfo) => {
      // Update all wallet-related queries
      queryClient.setQueryData(walletQueryKeys.info(), walletInfo);
      queryClient.setQueryData(walletQueryKeys.hasWallet(), true);
      queryClient.invalidateQueries({ queryKey: walletQueryKeys.all });
    },
    onError: (error) => {
      console.error("Wallet import from mnemonic failed:", error);
    }
  });
};

export const useWallet = () => {
  return useQuery({
    queryKey: walletQueryKeys.info(),
    queryFn: getWallet,
    staleTime: STALE_TIMES.MEDIUM
  });
};

export const useWalletKeypair = (enabled: boolean = true) => {
  return useQuery({
    queryKey: walletQueryKeys.keypair(),
    queryFn: getKeypair,
    enabled,
    staleTime: STALE_TIMES.MEDIUM
  });
};

export const useHasWallet = () => {
  return useQuery({
    queryKey: walletQueryKeys.hasWallet(),
    queryFn: hasWallet,
    staleTime: STALE_TIMES.SHORT
  });
};

export const useHasWalletWithBackendCheck = (
  credentials?: AuthCredentials,
  enabled: boolean = true
) => {
  console.log("Enabled in useHasWalletWithBackendCheck", enabled);
  console.log("Credentials in useHasWalletWithBackendCheck", credentials);
  return useQuery({
    queryKey: walletQueryKeys.hasWalletBackend(credentials?.userId || ""),
    queryFn: () => {
      if (!credentials) {
        throw new Error("Not authenticated");
      }
      return hasWalletWithBackendCheck(credentials);
    },
    enabled: enabled && !!credentials,
    staleTime: STALE_TIMES.SHORT
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
      console.error("Wallet deletion failed:", error);
    }
  });
};

export const usePrivateKey = (enabled: boolean = false) => {
  return useQuery({
    queryKey: walletQueryKeys.privateKey(),
    queryFn: getPrivateKey,
    enabled,
    staleTime: STALE_TIMES.SHORT
  });
};

export const useCheckWalletExists = (
  credentials?: AuthCredentials,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: walletQueryKeys.checkExists(credentials?.userId || ""),
    queryFn: () => {
      if (!credentials) {
        throw new Error("Not authenticated");
      }
      return checkWalletExists(credentials);
    },
    enabled: enabled && !!credentials,
    staleTime: STALE_TIMES.MEDIUM
  });
};

export const useCreateDeterministicWallet = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (authCredentials?: AuthCredentials) =>
      createDeterministicWallet(authCredentials),
    onSuccess: (walletInfo) => {
      const credentials = getAuthCredentials();
      queryClient.setQueryData(walletQueryKeys.info(), walletInfo);
      queryClient.setQueryData(walletQueryKeys.hasWallet(), true);
      if (credentials) {
        queryClient.setQueryData(
          walletQueryKeys.checkExists(credentials.userId),
          {
            exists: true,
            wallet: walletInfo
          }
        );
        queryClient.setQueryData(
          walletQueryKeys.hasWalletBackend(credentials.userId),
          true
        );
      }
      queryClient.invalidateQueries({ queryKey: walletQueryKeys.all });
    },
    onError: (error) => {
      console.error("Deterministic wallet creation failed:", error);
    }
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
  const createDeterministicMutation = useCreateDeterministicWallet();
  const createWithMnemonicMutation = useCreateWalletWithMnemonic();
  const importFromMnemonicMutation = useImportFromMnemonic();

  return {
    createWallet: createMutation.mutate,
    createWalletAsync: createMutation.mutateAsync,
    importWallet: importMutation.mutate,
    importWalletAsync: importMutation.mutateAsync,
    deleteWallet: deleteMutation.mutate,
    deleteWalletAsync: deleteMutation.mutateAsync,
    createDeterministicWallet: createDeterministicMutation.mutate,
    createDeterministicWalletAsync: createDeterministicMutation.mutateAsync,
    createWalletWithMnemonic: createWithMnemonicMutation.mutate,
    createWalletWithMnemonicAsync: createWithMnemonicMutation.mutateAsync,
    importFromMnemonic: importFromMnemonicMutation.mutate,
    importFromMnemonicAsync: importFromMnemonicMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isImporting: importMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isCreatingDeterministic: createDeterministicMutation.isPending,
    isCreatingWithMnemonic: createWithMnemonicMutation.isPending,
    isImportingFromMnemonic: importFromMnemonicMutation.isPending,
    error:
      createMutation.error ||
      importMutation.error ||
      deleteMutation.error ||
      createDeterministicMutation.error ||
      createWithMnemonicMutation.error ||
      importFromMnemonicMutation.error
  };
};
