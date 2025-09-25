import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BASE_URL,
  DEFAULT_TIMEOUT,
  HEALTH_CHECK_TIMEOUT,
  API_ENDPOINTS,
  RETRY_CONFIG
} from "../lib/constants/api.constants";
import {
  createTimeoutSignal,
  handleHttpError,
  isRetryableError,
  calculateRetryDelay,
  sleep,
  validateHttpResponse
} from "../lib/utils/http.utils";

export interface TransactionRequest {
  walletAddress: string;
  signedTransactionXDR: string;
  transactionType?: string;
}

export interface TransactionResponse {
  success: boolean;
  transactionHash?: string;
  result?: any;
  config?: {
    timeout: number;
    rateLimitRemaining: number;
  };
  error?: string;
}

export interface CheckWalletRequest {
  userId: string; // Email address for account consistency and merging
  publicKey?: string; // Optional: for additional verification
}

export interface CheckWalletResponse {
  exists: boolean;
  walletData?: {
    publicKey: string;
    address: string;
    salt: string;
  };
  error?: string;
}

// Core API functions
export const submitTransaction = async (
  walletAddress: string,
  signedTransactionXDR: string,
  transactionType: string = "transaction"
): Promise<TransactionResponse> => {
  try {
    const requestBody: TransactionRequest = {
      walletAddress,
      signedTransactionXDR,
      transactionType
    };

    const response = await fetch(`${BASE_URL}${API_ENDPOINTS.transaction}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody),
      signal: createTimeoutSignal(DEFAULT_TIMEOUT)
    });

    return (await validateHttpResponse(response)) as TransactionResponse;
  } catch (error) {
    throw handleHttpError(error);
  }
};

export const submitTransactionWithRetry = async (
  walletAddress: string,
  signedTransactionXDR: string,
  transactionType: string = "transaction",
  maxRetries: number = 3
): Promise<TransactionResponse> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await submitTransaction(
        walletAddress,
        signedTransactionXDR,
        transactionType
      );
    } catch (error) {
      lastError = error as Error;

      // Don't retry for certain errors
      if (error instanceof Error && !isRetryableError(error)) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const delay = calculateRetryDelay(attempt);
        await sleep(delay);
      }
    }
  }

  throw new Error(
    `Transaction failed after ${maxRetries} attempts: ${lastError!.message}`
  );
};

export const healthCheck = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${BASE_URL}${API_ENDPOINTS.health}`, {
      method: "GET",
      signal: createTimeoutSignal(HEALTH_CHECK_TIMEOUT)
    });
    return response.ok;
  } catch {
    return false;
  }
};

export const getApiStatus = async (): Promise<{
  status: string;
  version?: string;
  rateLimits?: any;
}> => {
  try {
    const response = await fetch(`${BASE_URL}${API_ENDPOINTS.status}`, {
      method: "GET",
      signal: createTimeoutSignal(HEALTH_CHECK_TIMEOUT)
    });

    return await validateHttpResponse(response);
  } catch (error) {
    throw new Error(`Failed to get API status: ${error}`);
  }
};

export const checkWallet = async (
  userId: string, // Email address from Clerk auth (for backend lookup)
  publicKey?: string // Optional: for verification
): Promise<CheckWalletResponse> => {
  try {
    const requestBody: CheckWalletRequest = {
      userId, // Email address for backend wallet lookup
      publicKey
    };

    const response = await fetch(`${BASE_URL}${API_ENDPOINTS.checkWallet}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody),
      signal: createTimeoutSignal(DEFAULT_TIMEOUT)
    });

    return (await validateHttpResponse(response)) as CheckWalletResponse;
  } catch (error) {
    throw handleHttpError(error);
  }
};

// Query Keys
export const apiQueryKeys = {
  health: ["api", "health"] as const,
  status: ["api", "status"] as const,
  checkWallet: (userId: string, publicKey?: string) =>
    ["api", "checkWallet", userId, publicKey] as const
};

// Custom Hooks
export const useSubmitTransaction = () => {
  return useMutation({
    mutationFn: ({
      walletAddress,
      signedTransactionXDR,
      transactionType = "transaction"
    }: {
      walletAddress: string;
      signedTransactionXDR: string;
      transactionType?: string;
    }) =>
      submitTransaction(walletAddress, signedTransactionXDR, transactionType),
    onError: (error) => {
      console.error("Transaction submission failed:", error);
    }
  });
};

export const useSubmitTransactionWithRetry = () => {
  return useMutation({
    mutationFn: ({
      walletAddress,
      signedTransactionXDR,
      transactionType = "transaction",
      maxRetries = 3
    }: {
      walletAddress: string;
      signedTransactionXDR: string;
      transactionType?: string;
      maxRetries?: number;
    }) =>
      submitTransactionWithRetry(
        walletAddress,
        signedTransactionXDR,
        transactionType,
        maxRetries
      ),
    onError: (error) => {
      console.error("Transaction submission with retry failed:", error);
    }
  });
};

export const useHealthCheck = (enabled: boolean = true) => {
  return useQuery({
    queryKey: apiQueryKeys.health,
    queryFn: healthCheck,
    enabled,
    refetchInterval: 30000, // Check every 30 seconds
    staleTime: 10000 // Consider stale after 10 seconds
  });
};

export const useApiStatus = (enabled: boolean = true) => {
  return useQuery({
    queryKey: apiQueryKeys.status,
    queryFn: getApiStatus,
    enabled,
    staleTime: 60000 // Consider stale after 1 minute
  });
};

export const useCheckWallet = (
  userId: string,
  publicKey?: string,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: apiQueryKeys.checkWallet(userId, publicKey),
    queryFn: () => checkWallet(userId, publicKey),
    enabled: enabled && !!userId,
    staleTime: 30000 // Consider stale after 30 seconds
  });
};
