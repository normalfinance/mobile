import { useCallback } from "react";
import {
  Networks,
  Horizon,
  Account,
  TransactionBuilder,
  Operation,
} from "@stellar/stellar-sdk";
import { getKeypair, getWallet } from "@/services/wallet.service";
import {
  NetworkConfig,
  SignTransactionParams,
  SignedTransactionResult,
  SubmitTransactionParams,
  BackendSubmissionResult,
  GenerateSwapXDRParams,
} from "@/lib/types/transaction.types";
import {
  parseTransaction,
  signTransactionWithKeypair,
} from "@/lib/utils/stellar.utils";
import { STELLAR_ERRORS } from "@/lib/constants/stellar.constants";
import { buildSwapTransaction } from "@/lib/utils/pool-router.utils";

const getNetworkConfig = (): NetworkConfig => {
  const network = process.env.EXPO_PUBLIC_NETWORK || "TESTNET";
  // Check for RPC API key (supports both EXPO_PUBLIC_ prefix and non-prefixed for compatibility)
  const rpcApiKey =
    process.env.EXPO_PUBLIC_RPC_API_KEY || process.env.RPC_API_KEY || "";

  if (network === "MAINNET") {
    // If RPC API key is provided, use validationcloud.io endpoint with API key
    const rpcUrl = rpcApiKey
      ? `https://mainnet.stellar.validationcloud.io/v1/${rpcApiKey}`
      : process.env.EXPO_PUBLIC_MAINNET_RPC_URL ||
        "https://soroban.stellar.org";

    return {
      networkPassphrase: Networks.PUBLIC,
      horizonUrl:
        process.env.EXPO_PUBLIC_MAINNET_HORIZON_URL ||
        "https://horizon.stellar.org",
      rpcUrl,
    };
  } else {
    // If RPC API key is provided, use validationcloud.io endpoint with API key
    const rpcUrl = rpcApiKey
      ? `https://testnet.stellar.validationcloud.io/v1/${rpcApiKey}`
      : process.env.EXPO_PUBLIC_TESTNET_RPC_URL ||
        "https://soroban-testnet.stellar.org";

    return {
      networkPassphrase: Networks.TESTNET,
      horizonUrl:
        process.env.EXPO_PUBLIC_TESTNET_HORIZON_URL ||
        "https://horizon-testnet.stellar.org",
      rpcUrl,
    };
  }
};

export const useTransactionOperations = () => {
  // Utility function to get a source account - can be used by specialized hooks
  const getSourceAccount = useCallback(
    async (account?: Account): Promise<Account> => {
      if (account) {
        return account;
      }

      const keypair = await getKeypair();
      if (!keypair) {
        throw new Error(STELLAR_ERRORS.NO_WALLET);
      }

      const config = getNetworkConfig();
      const horizonServer = new Horizon.Server(config.horizonUrl);

      try {
        const sourceAccount = await horizonServer.loadAccount(
          keypair.publicKey()
        );
        console.log(
          "✅ Account loaded. Sequence:",
          sourceAccount.sequenceNumber()
        );
        return sourceAccount;
      } catch (error) {
        console.error("❌ Failed to load account:", error);
        throw new Error(
          `Failed to load account ${keypair.publicKey()}: ${error}`
        );
      }
    },
    []
  );

  const signTransaction = useCallback(
    async (
      unsignedXDR: string,
      networkPassphrase?: string
    ): Promise<SignedTransactionResult> => {
      console.log("✍️ Signing transaction...");

      try {
        const keypair = await getKeypair();
        if (!keypair) {
          throw new Error(STELLAR_ERRORS.NO_WALLET);
        }

        const walletInfo = await getWallet();
        if (!walletInfo) {
          throw new Error(STELLAR_ERRORS.NO_WALLET_INFO);
        }

        const config = getNetworkConfig();
        const passphrase = networkPassphrase || config.networkPassphrase;

        const transaction = parseTransaction(unsignedXDR, passphrase);

        signTransactionWithKeypair(transaction, keypair);

        const signedXDR = transaction.toXDR();
        const transactionHash = transaction.hash().toString("hex");

        console.log("✅ Transaction signed successfully!");

        return {
          signedXDR,
          transactionHash,
          walletAddress: walletInfo.publicKey,
        };
      } catch (error) {
        console.error("❌ Error signing transaction:", error);
        throw new Error(`${STELLAR_ERRORS.SIGN_FAILED}: ${error}`);
      }
    },
    []
  );

  const submitTransactionToBackend = useCallback(
    async (
      params: SubmitTransactionParams
    ): Promise<BackendSubmissionResult> => {
      console.log("🚀 Submitting transaction to backend...");
      console.log("📄 Signed XDR length:", params.signedXDR.length);

      try {
        const backendUrl = "http://localhost:8095/api/transaction";

        const payload = {
          walletAddress: params.walletAddress,
          signedTransactionXDR: params.signedXDR,
          transactionType: params.transactionType,
        };

        console.log("📦 Backend payload:", JSON.stringify(payload, null, 2));
        console.log("🌐 Submitting to backend URL:", backendUrl);

        const response = await fetch(backendUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(
            `Backend request failed: ${response.status} ${response.statusText}`
          );
        }

        const responseData = await response.json();
        console.log("✅ Backend response:", responseData);

        return {
          success: true,
          transactionHash:
            responseData.hash ||
            responseData.transactionHash ||
            `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          backendResponse: responseData,
        };
      } catch (error) {
        console.error("❌ Backend submission failed:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    []
  );

  const generateTransactionXDR = useCallback(
    async (params: {
      contractAddress: string;
      method: string;
      args: any[];
      account?: Account;
    }): Promise<string> => {
      console.log("🔨 Generating transaction XDR...");

      const config = getNetworkConfig();
      const sourceAccount = await getSourceAccount(params.account);

      const transaction = new TransactionBuilder(sourceAccount, {
        fee: "100000", // 0.01 XLM
        networkPassphrase: config.networkPassphrase,
      })
        .addOperation(
          Operation.invokeContractFunction({
            contract: params.contractAddress,
            function: params.method,
            args: params.args,
          })
        )
        .setTimeout(300)
        .build();

      return transaction.toXDR();
    },
    [getSourceAccount]
  );

  const generateSwapTransactionXDR = useCallback(
    async (params: GenerateSwapXDRParams): Promise<string> => {
      console.log("🔨 Generating swap transaction XDR...");

      const config = params.networkConfig || getNetworkConfig();
      const sourceAccount = await getSourceAccount(params.account);

      const { transaction: assembledTransaction } = await buildSwapTransaction(
        params.poolRouterAddress,
        {
          user: params.user,
          tokenIn: params.tokenInAddress,
          tokenOut: params.tokenOutAddress,
          amountIn: params.amountIn,
          amountOutMin: params.amountOutMin,
          poolContext: params.poolContext,
        },
        sourceAccount,
        {
          networkPassphrase: config.networkPassphrase,
          rpcUrl: config.rpcUrl,
        }
      );

      console.log("🔨 Assembled transaction:", assembledTransaction);

      const unsignedXDR = assembledTransaction.toXDR();
      if (!unsignedXDR) {
        throw new Error("Failed to generate swap transaction XDR");
      }

      return unsignedXDR;
    },
    [getSourceAccount]
  );

  return {
    generateTransactionXDR,
    generateSwapTransactionXDR,
    signTransaction,
    submitTransactionToBackend,
    getNetworkConfig,
    getSourceAccount, // Utility for specialized hooks to get account
  };
};
