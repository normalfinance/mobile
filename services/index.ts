// Wallet Service - Core functions and hooks
export {
  createWallet,
  importFromPrivateKey,
  getWallet,
  getKeypair,
  hasWallet,
  deleteWallet,
  getPrivateKey,
  checkWalletExists,
  createDeterministicWallet,
  hasWalletWithBackendCheck,
  walletQueryKeys,
  useCreateWallet,
  useImportWallet,
  useWallet,
  useWalletKeypair,
  useHasWallet,
  useDeleteWallet,
  usePrivateKey,
  useCheckWalletExists,
  useCreateDeterministicWallet,
  useHasWalletWithBackendCheck,
  useWalletStatus,
  useWalletActions
} from "./wallet.service";

// Transaction Service - Core functions and hooks
export {
  signTransaction,
  verifyTransaction,
  getTransactionDetails,
  transactionQueryKeys,
  useSignTransaction,
  useVerifyTransaction,
  useTransactionDetails,
  useProcessTransaction
} from "./transaction.service";

// API Service - Core functions and hooks
export {
  submitTransaction,
  submitTransactionWithRetry,
  healthCheck,
  getApiStatus,
  checkWallet,
  apiQueryKeys,
  useSubmitTransaction,
  useSubmitTransactionWithRetry,
  useHealthCheck,
  useApiStatus,
  useCheckWallet
} from "./api.service";

// Auth Service - Core functions and hooks
export {
  getAuthCredentials,
  getCurrentUserId,
  getCurrentSessionSecret,
  isUserAuthenticated,
  requireAuth,
  authQueryKeys,
  useAuthCredentials,
  useAuthStatus,
  useRequireAuth
} from "./auth.service";

// Type exports
export type { WalletInfo } from "./wallet.service";
export type { SignedTransaction } from "./transaction.service";
export type { TransactionRequest, TransactionResponse, CheckWalletRequest, CheckWalletResponse } from "./api.service";
export type { AuthCredentials, AuthStatus } from "./auth.service";
