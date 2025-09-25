import { Networks } from "@stellar/stellar-sdk";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getWallet, getKeypair, walletQueryKeys } from "./wallet.service";
import {
  NETWORK_PASSPHRASE,
  STELLAR_ERRORS
} from "../lib/constants/stellar.constants";
import {
  parseTransaction,
  getTransactionDetails as getTransactionDetailsUtil,
  verifyTransactionSignature,
  signTransactionWithKeypair,
  TransactionDetails
} from "../lib/utils/stellar.utils";
import { STALE_TIMES } from "../lib/utils/query.utils";

export interface SignedTransaction {
  signedXDR: string;
  transactionHash: string;
  walletAddress: string;
}

// Core transaction functions
export const signTransaction = async (
  unsignedXDR: string
): Promise<SignedTransaction> => {
  try {
    // Get the user's keypair
    const keypair = await getKeypair();
    if (!keypair) {
      throw new Error(STELLAR_ERRORS.NO_WALLET);
    }

    // Get wallet info for the address
    const walletInfo = await getWallet();
    if (!walletInfo) {
      throw new Error(STELLAR_ERRORS.NO_WALLET_INFO);
    }

    // Parse the transaction from XDR
    const transaction = parseTransaction(unsignedXDR);

    // Sign the transaction
    signTransactionWithKeypair(transaction, keypair);

    // Get the signed XDR
    const signedXDR = transaction.toXDR();

    // Calculate transaction hash
    const transactionHash = transaction.hash().toString("hex");

    return {
      signedXDR,
      transactionHash,
      walletAddress: walletInfo.publicKey
    };
  } catch (error) {
    throw new Error(`${STELLAR_ERRORS.SIGN_FAILED}: ${error}`);
  }
};

export const verifyTransaction = async (
  signedXDR: string,
  expectedWalletAddress: string
): Promise<boolean> => {
  try {
    // Parse the signed transaction
    const transaction = parseTransaction(signedXDR);

    // Get the wallet info
    const walletInfo = await getWallet();
    if (!walletInfo || walletInfo.publicKey !== expectedWalletAddress) {
      return false;
    }

    // Get the keypair for verification
    const keypair = await getKeypair();
    if (!keypair) {
      return false;
    }

    // Verify signature
    return verifyTransactionSignature(transaction, keypair);
  } catch (error) {
    console.error(STELLAR_ERRORS.VERIFY_FAILED, error);
    return false;
  }
};

export const getTransactionDetails = (xdr: string): TransactionDetails => {
  return getTransactionDetailsUtil(xdr);
};

// Query Keys
export const transactionQueryKeys = {
  all: ["transactions"] as const,
  details: (xdr: string) =>
    [...transactionQueryKeys.all, "details", xdr] as const,
  verification: (signedXDR: string, address: string) =>
    [...transactionQueryKeys.all, "verification", signedXDR, address] as const
};

// Custom Hooks
export const useSignTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unsignedXDR }: { unsignedXDR: string }) =>
      signTransaction(unsignedXDR),
    onSuccess: (data) => {
      // Invalidate wallet queries in case balance changed
      queryClient.invalidateQueries({ queryKey: walletQueryKeys.all });
    },
    onError: (error) => {
      console.error("Transaction signing failed:", error);
    }
  });
};

export const useVerifyTransaction = (
  signedXDR?: string,
  expectedAddress?: string
) => {
  return useQuery({
    queryKey: transactionQueryKeys.verification(
      signedXDR || "",
      expectedAddress || ""
    ),
    queryFn: () => verifyTransaction(signedXDR!, expectedAddress!),
    enabled: Boolean(signedXDR && expectedAddress),
    staleTime: STALE_TIMES.MEDIUM
  });
};

export const useTransactionDetails = (xdr?: string) => {
  return useQuery({
    queryKey: transactionQueryKeys.details(xdr || ""),
    queryFn: () => getTransactionDetails(xdr!),
    enabled: Boolean(xdr),
    staleTime: STALE_TIMES.INFINITE
  });
};

// Utility hook for processing transactions (sign + submit)
export const useProcessTransaction = () => {
  const signMutation = useSignTransaction();

  return {
    ...signMutation,
    signTransaction: signMutation.mutate,
    signTransactionAsync: signMutation.mutateAsync
  };
};
