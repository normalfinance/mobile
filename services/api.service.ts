import { useMutation, useQuery } from '@tanstack/react-query';

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

const BASE_URL = 'https://api.normalfinance.io';
const DEFAULT_TIMEOUT = 30000; // 30 seconds

// Core API functions
export const submitTransaction = async (
  walletAddress: string,
  signedTransactionXDR: string,
  transactionType: string = 'transaction'
): Promise<TransactionResponse> => {
  try {
    const requestBody: TransactionRequest = {
      walletAddress,
      signedTransactionXDR,
      transactionType
    };

    const response = await fetch(`${BASE_URL}/transaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return data as TransactionResponse;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TimeoutError') {
        throw new Error('Transaction submission timed out. Please try again.');
      }
      if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
        throw new Error('Network error. Please check your connection and try again.');
      }
      throw error;
    }
    throw new Error('An unknown error occurred while submitting transaction.');
  }
};

export const submitTransactionWithRetry = async (
  walletAddress: string,
  signedTransactionXDR: string,
  transactionType: string = 'transaction',
  maxRetries: number = 3
): Promise<TransactionResponse> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await submitTransaction(walletAddress, signedTransactionXDR, transactionType);
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry for certain errors
      if (
        error instanceof Error && (
          error.message.includes('Rate limit exceeded') ||
          error.message.includes('Invalid signature') ||
          error.message.includes('400') ||
          error.message.includes('403')
        )
      ) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Transaction failed after ${maxRetries} attempts: ${lastError!.message}`);
};

export const healthCheck = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${BASE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout for health check
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
    const response = await fetch(`${BASE_URL}/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`Status check failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Failed to get API status: ${error}`);
  }
};

// Query Keys
export const apiQueryKeys = {
  health: ['api', 'health'] as const,
  status: ['api', 'status'] as const,
};

// Custom Hooks
export const useSubmitTransaction = () => {
  return useMutation({
    mutationFn: ({ 
      walletAddress, 
      signedTransactionXDR, 
      transactionType = 'transaction' 
    }: {
      walletAddress: string;
      signedTransactionXDR: string;
      transactionType?: string;
    }) => submitTransaction(walletAddress, signedTransactionXDR, transactionType),
    onError: (error) => {
      console.error('Transaction submission failed:', error);
    }
  });
};

export const useSubmitTransactionWithRetry = () => {
  return useMutation({
    mutationFn: ({ 
      walletAddress, 
      signedTransactionXDR, 
      transactionType = 'transaction',
      maxRetries = 3
    }: {
      walletAddress: string;
      signedTransactionXDR: string;
      transactionType?: string;
      maxRetries?: number;
    }) => submitTransactionWithRetry(walletAddress, signedTransactionXDR, transactionType, maxRetries),
    onError: (error) => {
      console.error('Transaction submission with retry failed:', error);
    }
  });
};

export const useHealthCheck = (enabled: boolean = true) => {
  return useQuery({
    queryKey: apiQueryKeys.health,
    queryFn: healthCheck,
    enabled,
    refetchInterval: 30000, // Check every 30 seconds
    staleTime: 10000, // Consider stale after 10 seconds
  });
};

export const useApiStatus = (enabled: boolean = true) => {
  return useQuery({
    queryKey: apiQueryKeys.status,
    queryFn: getApiStatus,
    enabled,
    staleTime: 60000, // Consider stale after 1 minute
  });
};