import { useCallback } from "react";
import { buildTrustlineTransaction } from "../lib/utils/trustline.utils";
import { useTransactionOperations } from "./use-transaction";

export interface CreateTrustlineParams {
  assetCode: string;
  assetIssuer: string;
}

export interface TrustlineResult {
  transactionHash: string;
  assetCode: string;
  assetIssuer: string;
}

export const useTrustline = () => {
  const {
    getSourceAccount,
    getNetworkConfig,
    signTransaction,
    submitTransactionToBackend,
  } = useTransactionOperations();

  const createTrustline = useCallback(
    async (params: CreateTrustlineParams): Promise<TrustlineResult> => {
      console.log(
        `🔗 Creating trustline for ${params.assetCode} (${params.assetIssuer})...`
      );
      console.log("📋 Trustline params:", JSON.stringify(params, null, 2));

      try {
        // Validate params
        if (!params.assetCode || !params.assetIssuer) {
          throw new Error(
            `Invalid trustline parameters: assetCode=${params.assetCode}, assetIssuer=${params.assetIssuer}`
          );
        }

        // Validate asset code format (1-12 alphanumeric characters)
        if (!/^[a-zA-Z0-9]{1,12}$/.test(params.assetCode)) {
          throw new Error(
            `Invalid asset code format: "${params.assetCode}". Must be 1-12 alphanumeric characters.`
          );
        }

        const config = getNetworkConfig();

        // Get source account with sequence number (loads from Horizon)
        const sourceAccount = await getSourceAccount();

        console.log(`📝 Building trustline transaction for ${params.assetCode}...`);

        // Build the trustline transaction
        const trustlineTx = buildTrustlineTransaction(
          sourceAccount,
          params.assetCode,
          params.assetIssuer,
          config.networkPassphrase
        );

        console.log("✅ Trustline transaction built");
        console.log("🔏 Signing trustline transaction directly...");

        // Get the keypair for signing
        const { getKeypair } = await import("../services/wallet.service");
        const keypair = await getKeypair();
        if (!keypair) {
          throw new Error("No wallet found");
        }

        const { getWallet } = await import("../services/wallet.service");
        const walletInfo = await getWallet();
        if (!walletInfo) {
          throw new Error("No wallet info found");
        }

        // Sign the transaction directly
        const { signTransactionWithKeypair } = await import("../lib/utils/stellar.utils");
        signTransactionWithKeypair(trustlineTx, keypair);

        console.log("✅ Transaction signed, converting to XDR...");

        // Now convert signed transaction to XDR
        const signedXDR = trustlineTx.toXDR();
        const walletAddress = walletInfo.publicKey;

        console.log("📤 Submitting trustline transaction to backend...");

        // Submit to backend
        const response = await submitTransactionToBackend({
          signedXDR,
          transactionType: "Create Trustline",
          walletAddress,
        });

        if (!response?.success || !response?.backendResponse?.result?.hash) {
          throw new Error("Failed to get transaction hash from backend");
        }

        console.log(
          `✅ Trustline created successfully! Hash: ${response.backendResponse.result.hash}`
        );

        return {
          transactionHash: response.backendResponse.result.hash,
          assetCode: params.assetCode,
          assetIssuer: params.assetIssuer,
        };
      } catch (error: any) {
        console.error("❌ Failed to create trustline:", error);
        throw new Error(
          `Failed to create trustline: ${error?.message || "Unknown error"}`
        );
      }
    },
    [getSourceAccount, getNetworkConfig, signTransaction, submitTransactionToBackend]
  );

  return {
    createTrustline,
  };
};

