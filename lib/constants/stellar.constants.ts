import { Networks } from "@stellar/stellar-sdk";

export const NETWORK_PASSPHRASE = Networks.PUBLIC;

export const STELLAR_CONFIG = {
  TESTNET_PASSPHRASE: Networks.TESTNET,
  PUBLIC_PASSPHRASE: Networks.PUBLIC
} as const;

export const STELLAR_ERRORS = {
  NO_WALLET: "No wallet found. Please create or import a wallet first.",
  NO_WALLET_INFO: "Wallet information not found.",
  SIGN_FAILED: "Failed to sign transaction",
  VERIFY_FAILED: "Transaction verification failed",
  PARSE_FAILED: "Failed to parse transaction"
} as const;
