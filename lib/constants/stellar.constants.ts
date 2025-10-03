import { Networks } from "@stellar/stellar-sdk";

export const NETWORK_PASSPHRASE = Networks.TESTNET;

export const STELLAR_CONFIG = {
  TESTNET_PASSPHRASE: Networks.TESTNET,
  PUBLIC_PASSPHRASE: Networks.PUBLIC,
  HORIZON_URLS: {
    TESTNET: "https://horizon-testnet.stellar.org",
    PUBLIC: "https://horizon.stellar.org"
  },
  SOROBAN_RPC_URLS: {
    TESTNET: "https://soroban-testnet.stellar.org",
    PUBLIC: "https://soroban.stellar.org"
  }
} as const;

export const STELLAR_ERRORS = {
  NO_WALLET: "No wallet found. Please create or import a wallet first.",
  NO_WALLET_INFO: "Wallet information not found.",
  SIGN_FAILED: "Failed to sign transaction",
  VERIFY_FAILED: "Transaction verification failed",
  PARSE_FAILED: "Failed to parse transaction",
  ACCOUNT_NOT_FOUND: "Account not found on the Stellar network",
  BALANCE_FETCH_FAILED: "Failed to fetch account balance",
  HORIZON_ERROR: "Horizon server error"
} as const;
