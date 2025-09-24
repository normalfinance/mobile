import { Transaction, Networks } from "@stellar/stellar-sdk";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getWallet, getKeypair, walletQueryKeys } from "./wallet.service";

export interface SignedTransaction {
  signedXDR: string;
  transactionHash: string;
  walletAddress: string;
}

export interface TransactionDetails {
  hash: string;
  operations: any[];
  fee: string;
  sequence: string;
}

// Stellar network passphrase (you can configure this based on your environment)
const NETWORK_PASSPHRASE = Networks.PUBLIC; // Use Networks.TESTNET for testnet

// Core transaction functions
export const signTransaction = async (
  unsignedXDR: string
): Promise<SignedTransaction> => {
  try {
    // Get the user's keypair
    const keypair = await getKeypair();
    if (!keypair) {
      throw new Error(
        "No wallet found. Please create or import a wallet first."
      );
    }

    // Get wallet info for the address
    const walletInfo = await getWallet();
    if (!walletInfo) {
      throw new Error("Wallet information not found.");
    }

    // Parse the transaction from XDR
    const transaction = new Transaction(unsignedXDR, NETWORK_PASSPHRASE);

    // Sign the transaction
    transaction.sign(keypair);

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
    throw new Error(`Failed to sign transaction: ${error}`);
  }
};

export const verifyTransaction = async (
  signedXDR: string,
  expectedWalletAddress: string
): Promise<boolean> => {
  try {
    // Parse the signed transaction
    const transaction = new Transaction(signedXDR, NETWORK_PASSPHRASE);

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
    return transaction.signatures.some((sig) => {
      try {
        return keypair.verify(transaction.hash(), sig.signature());
      } catch {
        return false;
      }
    });
  } catch (error) {
    console.error("Transaction verification failed:", error);
    return false;
  }
};

export const getTransactionDetails = (xdr: string): TransactionDetails => {
  try {
    const transaction = new Transaction(xdr, NETWORK_PASSPHRASE);

    return {
      hash: transaction.hash().toString("hex"),
      operations: transaction.operations.map((op) => ({
        type: op.type
        // Add more operation details as needed
      })),
      fee: transaction.fee,
      sequence: transaction.sequence
    };
  } catch (error) {
    throw new Error(`Failed to parse transaction: ${error}`);
  }
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
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};

export const useTransactionDetails = (xdr?: string) => {
  return useQuery({
    queryKey: transactionQueryKeys.details(xdr || ""),
    queryFn: () => getTransactionDetails(xdr!),
    enabled: Boolean(xdr),
    staleTime: Infinity // Transaction details don't change
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
