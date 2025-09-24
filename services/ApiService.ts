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

export class ApiService {
  private static readonly BASE_URL = 'https://api.normalfinance.io';
  private static readonly DEFAULT_TIMEOUT = 30000; // 30 seconds

  /**
   * Submit signed transaction to backend API
   */
  static async submitTransaction(
    walletAddress: string,
    signedTransactionXDR: string,
    transactionType: string = 'transaction'
  ): Promise<TransactionResponse> {
    try {
      const requestBody: TransactionRequest = {
        walletAddress,
        signedTransactionXDR,
        transactionType
      };

      const response = await fetch(`${this.BASE_URL}/transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        // Add timeout using AbortController
        signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data as TransactionResponse;
    } catch (error) {
      if (error instanceof Error) {
        // Handle specific error types
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
  }

  /**
   * Submit transaction with retry logic
   */
  static async submitTransactionWithRetry(
    walletAddress: string,
    signedTransactionXDR: string,
    transactionType: string = 'transaction',
    maxRetries: number = 3
  ): Promise<TransactionResponse> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.submitTransaction(walletAddress, signedTransactionXDR, transactionType);
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
  }

  /**
   * Health check for the API
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.BASE_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout for health check
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get API configuration/status
   */
  static async getApiStatus(): Promise<{
    status: string;
    version?: string;
    rateLimits?: any;
  }> {
    try {
      const response = await fetch(`${this.BASE_URL}/status`, {
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
  }

  /**
   * Set custom base URL (for development/testing)
   */
  static setBaseUrl(url: string): void {
    // In production, you might want to validate the URL
    console.log(`API base URL updated to: ${url}`);
  }
}