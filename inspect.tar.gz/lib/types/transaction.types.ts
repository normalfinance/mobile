import { Account } from "@stellar/stellar-sdk";

export interface NetworkConfig {
  networkPassphrase: string;
  rpcUrl: string;
  horizonUrl: string;
}

export interface ContractCallParams {
  contractAddress: string;
  method: string;
  args: any[];
  source?: Account;
}

export interface GenerateXDRParams {
  contractAddress: string;
  method: string;
  args: any[]; // Arguments to pass to the contract method
  account?: Account;
  networkConfig?: NetworkConfig;
}

export interface SignTransactionParams {
  unsignedXDR: string;
  networkPassphrase?: string;
}

export interface SignedTransactionResult {
  signedXDR: string;
  transactionHash: string;
  walletAddress: string;
}

export interface TransactionOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  transactionHash?: string;
}

// Specific operation parameter types (for convenience)
export interface SwapTransactionParams {
  poolRouterAddress: string;
  user: string;
  asset_in: string;
  asset_out: string;
  amount_in: bigint;
  amount_out_min: bigint;
}

export interface GenerateSwapXDRParams {
  poolRouterAddress: string;
  user: string;
  asset_in: string;
  asset_out: string;
  amount_in: bigint;
  amount_out_min: bigint;
  account?: Account;
  networkConfig?: NetworkConfig;
}

// Generic contract operation parameters
export interface ContractOperationParams {
  contractAddress: string;
  method: string;
  args: any[];
}

export interface SubmitTransactionParams {
  signedXDR: string;
  transactionType: string;
  walletAddress: string;
}

export interface BackendSubmissionResult {
  success: boolean;
  transactionHash?: string;
  backendResponse?: any;
  error?: string;
}
