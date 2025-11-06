import { Transaction, Keypair } from "@stellar/stellar-sdk";
import {
  NETWORK_PASSPHRASE,
  STELLAR_ERRORS,
  IS_MAINNET
} from "../constants/stellar.constants";
import * as WebBrowser from "expo-web-browser";

type NetworkType = "testnet" | "mainnet";

export interface TransactionDetails {
  hash: string;
  operations: any[];
  fee: string;
  sequence: string;
}

export const parseTransaction = (
  xdr: string,
  networkPassphrase: string = NETWORK_PASSPHRASE
): Transaction => {
  try {
    return new Transaction(xdr, networkPassphrase);
  } catch (error) {
    throw new Error(`${STELLAR_ERRORS.PARSE_FAILED}: ${error}`);
  }
};

export const getTransactionHash = (transaction: Transaction): string => {
  return transaction.hash().toString("hex");
};

export const getTransactionDetails = (xdr: string): TransactionDetails => {
  const transaction = parseTransaction(xdr);

  return {
    hash: getTransactionHash(transaction),
    operations: transaction.operations.map((op) => ({
      type: op.type
    })),
    fee: transaction.fee,
    sequence: transaction.sequence
  };
};

export const verifyTransactionSignature = (
  transaction: Transaction,
  keypair: Keypair
): boolean => {
  return transaction.signatures.some((sig) => {
    try {
      return keypair.verify(transaction.hash(), sig.signature());
    } catch {
      return false;
    }
  });
};

export const signTransactionWithKeypair = (
  transaction: Transaction,
  keypair: Keypair
): void => {
  transaction.sign(keypair);
};

/**
 * Opens a transaction on Stellar Expert in the browser
 * @param hash - The transaction hash
 * @param network - The network type (testnet or mainnet)
 */
export const openStellarExpert = async (
  hash: string,
  network: NetworkType = "testnet"
) => {
  const baseUrl =
    network === "mainnet"
      ? "https://stellar.expert/explorer/public"
      : "https://stellar.expert/explorer/testnet";

  const url = `${baseUrl}/tx/${hash}`;

  try {
    await WebBrowser.openBrowserAsync(url);
  } catch (error) {
    console.error("Failed to open Stellar Expert:", error);
  }
};

/**
 * Gets the current network type based on environment configuration
 */
export const getCurrentNetwork = (): NetworkType => {
  return IS_MAINNET ? "mainnet" : "testnet";
};

/**
 * Creates a Stellar Expert transaction URL without opening it
 * @param hash - The transaction hash
 * @param network - The network type (testnet or mainnet)
 */
export const getStellarExpertUrl = (
  hash: string,
  network: NetworkType = "testnet"
): string => {
  const baseUrl =
    network === "mainnet"
      ? "https://stellar.expert/explorer/public"
      : "https://stellar.expert/explorer/testnet";

  return `${baseUrl}/tx/${hash}`;
};
