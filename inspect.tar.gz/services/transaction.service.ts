import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getWallet, walletQueryKeys } from "./wallet.service";
import { STELLAR_ERRORS } from "../lib/constants/stellar.constants";
import {
  getTransactionDetails as getTransactionDetailsUtil,
  TransactionDetails
} from "../lib/utils/stellar.utils";
import { STALE_TIMES } from "../lib/utils/query.utils";
import { useTransactionOperations } from "../hooks/use-transaction";
import {
  SignedTransactionResult,
  GenerateXDRParams,
  SubmitTransactionParams
} from "../lib/types/transaction.types";

// Legacy interface for backward compatibility
export interface SignedTransaction {
  signedXDR: string;
  transactionHash: string;
  walletAddress: string;
}

// Utility function for getting transaction details
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

export const useTransactionsService = () => {
  const transactionOps = useTransactionOperations();
  const queryClient = useQueryClient();

  const generateAndSignTransaction = useMutation({
    mutationFn: async (
      params: GenerateXDRParams
    ): Promise<SignedTransactionResult> => {
      console.log("🔧 Generating and signing transaction...");

      const unsignedXDR = await transactionOps.generateTransactionXDR(params);
      const signedResult = await transactionOps.signTransaction(unsignedXDR);

      return signedResult;
    },
    onSuccess: (data) => {
      console.log(
        "✅ Transaction generated and signed successfully:",
        data.transactionHash
      );
      // Invalidate wallet queries in case balance will change
      queryClient.invalidateQueries({ queryKey: walletQueryKeys.all });
    },
    onError: (error) => {
      console.error("❌ Transaction generation/signing failed:", error);
    }
  });

  const submitTransaction = useMutation({
    mutationFn: async (params: SubmitTransactionParams) => {
      console.log("🚀 Submitting transaction to backend...");

      return await transactionOps.submitTransactionToBackend(params);
    },
    onSuccess: (data) => {
      console.log("✅ Transaction submitted successfully:", data);
      // Invalidate wallet queries since balance has likely changed
      queryClient.invalidateQueries({ queryKey: walletQueryKeys.all });
    },
    onError: (error) => {
      console.error("❌ Transaction submission failed:", error);
    }
  });

  const generateSignAndSubmit = useMutation({
    mutationFn: async (params: {
      generateParams: GenerateXDRParams;
      transactionType: string;
    }) => {
      console.log("🎯 Executing full transaction flow...");

      // Step 1: Generate and sign
      const signedResult = await generateAndSignTransaction.mutateAsync(
        params.generateParams
      );

      // Step 2: Submit to backend
      const submitResult = await submitTransaction.mutateAsync({
        signedXDR: signedResult.signedXDR,
        transactionType: params.transactionType,
        walletAddress: signedResult.walletAddress
      });

      return {
        signedResult,
        submitResult
      };
    },
    onSuccess: (data) => {
      console.log("🎉 Full transaction flow completed:", data);
    },
    onError: (error) => {
      console.error("💥 Full transaction flow failed:", error);
    }
  });

  return {
    // Individual operations
    generateAndSignTransaction,
    submitTransaction,

    // Combined operation
    generateSignAndSubmit,

    // Direct access to core transaction operations
    ...transactionOps
  };
};

export const useTransactionDetails = (xdr?: string) => {
  return useQuery({
    queryKey: transactionQueryKeys.details(xdr || ""),
    queryFn: () => getTransactionDetails(xdr!),
    enabled: Boolean(xdr),
    staleTime: STALE_TIMES.INFINITE
  });
};

export const useTransactions = useTransactionsService;
