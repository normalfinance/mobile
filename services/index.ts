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
  useMnemonic,
  useHasWallet,
  useDeleteWallet,
  usePrivateKey,
  useCheckWalletExists,
  useCreateDeterministicWallet,
  useHasWalletWithBackendCheck,
  useWalletStatus,
  useWalletActions,
  useCreateWalletWithMnemonic,
  useImportFromMnemonic
} from "./wallet.service";

export {
  getTransactionDetails,
  transactionQueryKeys,
  useTransactions,
  useTransactionDetails
} from "./transaction.service";

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
  useRequireAuth,
  signInWithGoogle
} from "./auth.service";

// Type exports
export type { WalletInfo } from "./wallet.service";
export type { SignedTransaction } from "./transaction.service";
export type { AuthCredentials, AuthStatus } from "./auth.service";

export {
  getFeaturedAssets,
  getCollectionAssets,
  getAssetCategories
} from "./prices.service";

export {
  coinMarketCapService,
  useHistoricalPrices,
  coinMarketCapQueryKeys
} from "./coinmarketcap.service";
