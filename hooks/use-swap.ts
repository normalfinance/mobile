import { useCallback } from "react";
import { Account } from "@stellar/stellar-sdk";
import { useTransactionOperations } from "./use-transaction";
import { AVAILABLE_SWAP_TOKENS } from "../lib/constants/tokens.constants";
import { SwapParams, SwapResult } from "../lib/types/swap.types";
import { SwapTransactionParams } from "../lib/types/transaction.types";
import { getKeypair } from "../services/wallet.service";
import { ensureSwapTrustlines } from "../lib/utils/trustline.utils";
import {
  estimateSwap as routerEstimateSwap,
  toContractAmount,
  fromContractAmount,
  type EstimateSwapArgs as RouterEstimateSwapArgs,
  type SwapEstimateResult as RouterSwapEstimateResult,
  type PoolContext
} from "../lib/utils/pool-router.utils";

export type {
  EstimateSwapArgs,
  SwapEstimateResult,
  PoolContext
} from "../lib/utils/pool-router.utils";

type HookEstimateSwapArgs = RouterEstimateSwapArgs;
type HookSwapEstimateResult = RouterSwapEstimateResult;

interface EstimateNetworkConfig {
  rpcUrl: string;
  networkPassphrase: string;
  testingSource: Account;
}

const getPoolRouterAddress = () => {
  const network = process.env.EXPO_PUBLIC_NETWORK || "TESTNET";

  if (network === "MAINNET") {
    return (
      process.env.EXPO_PUBLIC_MAINNET_POOL_ROUTER ||
      "CCPHUHQYFOJJ6WQUGUYHHPJYQGFLRQHJJTRJNWQG54MHCHPRFLWQI7SE"
    );
  } else {
    return (
      process.env.EXPO_PUBLIC_TESTNET_POOL_ROUTER ||
      "CCYQV4LBUROO7IPWMQHGPRSNYM3BXEAHJYU5RAO52TJRG7KP23TY2C63"
    );
  }
};

export const useSwap = () => {
  const {
    generateTransactionXDR,
    generateSwapTransactionXDR,
    signTransaction,
    submitTransactionToBackend
  } = useTransactionOperations();

  const estimateSwap = useCallback(
    async (
      poolRouterAddress: string,
      args: HookEstimateSwapArgs,
      networkConfig: EstimateNetworkConfig
    ): Promise<HookSwapEstimateResult> => {
      console.log("🏊 Calling Pool Router estimate_swap...");
      console.log("Pool Router Address:", poolRouterAddress);
      console.log("Estimate Args:", {
        tokenIn: args.tokenIn,
        tokenOut: args.tokenOut,
        amountIn: args.amountIn.toString()
      });

      const result = await routerEstimateSwap(
        poolRouterAddress,
        args,
        networkConfig
      );

      console.log("✅ Pool Router estimate result:", {
        amountOut: result.amountOut.toString(),
        poolIndex: result.poolContext.poolIndex.toString("base64"),
        tokens: result.poolContext.tokens
      });

      return result;
    },
    []
  );

  const executeSwap = useCallback(
    async (swapParams: SwapParams): Promise<SwapResult> => {
      console.log(
        "🎯 Starting swap execution with transaction operations hook..."
      );

      try {
        const keypair = await getKeypair();
        if (!keypair) {
          throw new Error("No wallet found");
        }

        // Find token info for decimal conversion
        const tokenInInfo = AVAILABLE_SWAP_TOKENS.find(
          (t) => t.address === swapParams.tokenInAddress
        );
        const tokenOutInfo = AVAILABLE_SWAP_TOKENS.find(
          (t) => t.address === swapParams.tokenOutAddress
        );

        if (!tokenInInfo || !tokenOutInfo) {
          throw new Error(
            `Token info not found for swap: ${swapParams.tokenInAddress} -> ${swapParams.tokenOutAddress}`
          );
        }

        // Ensure trustlines exist before executing swap
        console.log("🔧 Ensuring trustlines for swap execution...");
        console.log(`   Token In: ${tokenInInfo.symbol} (${tokenInInfo.address})`);
        console.log(`   Token Out: ${tokenOutInfo.symbol} (${tokenOutInfo.address})`);
        try {
          await ensureSwapTrustlines(
            keypair.publicKey(),
            tokenInInfo.address,
            tokenInInfo.symbol,
            tokenOutInfo.address,
            tokenOutInfo.symbol
          );
          console.log("✅ Trustlines verified/added for execution");
        } catch (error: any) {
          const errorMessage = error?.message || "Unknown error";
          console.error("❌ Error ensuring trustlines:", errorMessage);
          throw new Error(`Failed to ensure trustlines before swap execution: ${errorMessage}`);
        }

        // Convert amounts to contract format (with proper decimals)
        const amountInContract = toContractAmount(
          swapParams.amountIn,
          tokenInInfo.decimals
        );
        const amountOutMinContract = toContractAmount(
          swapParams.amountOutMin,
          tokenOutInfo.decimals
        );

        // Create swap transaction parameters
        const swapTxParams: SwapTransactionParams = {
          poolRouterAddress: getPoolRouterAddress(),
          user: keypair.publicKey(),
          tokenInAddress: swapParams.tokenInAddress,
          tokenOutAddress: swapParams.tokenOutAddress,
          amountIn: amountInContract,
          amountOutMin: amountOutMinContract,
          poolContext: swapParams.poolContext
        };

        console.log("🔨 Generating transaction XDR...");

        const unsignedXDR = await generateSwapTransactionXDR({
          poolRouterAddress: swapTxParams.poolRouterAddress,
          user: swapTxParams.user,
          tokenInAddress: swapTxParams.tokenInAddress,
          tokenOutAddress: swapTxParams.tokenOutAddress,
          amountIn: swapTxParams.amountIn,
          amountOutMin: swapTxParams.amountOutMin,
          poolContext: swapTxParams.poolContext
        });

        console.log("✍️ Signing transaction...");

        // Step 2: Sign the transaction
        const { signedXDR, transactionHash, walletAddress } =
          await signTransaction(unsignedXDR);

        console.log("🚀 Submitting to backend...");

        // Step 3: Submit to backend
        const backendResult = await submitTransactionToBackend({
          signedXDR,
          transactionType: "Pool Router Swap",
          walletAddress
        });

        if (!backendResult.success) {
          throw new Error(backendResult.error || "Backend submission failed");
        }

        const result: SwapResult = {
          transactionHash: backendResult.transactionHash || transactionHash,
          amountIn: swapParams.amountIn,
          amountOut: swapParams.amountOutMin, // This would be updated by backend response
          tokenIn: swapParams.tokenInSymbol,
          tokenOut: swapParams.tokenOutSymbol,
          timestamp: Date.now(),
          backendResponse: backendResult.backendResponse
        };

        console.log("🎉 Swap completed successfully:", result);
        return result;
      } catch (error) {
        console.error("💥 Swap execution failed:", error);
        throw error;
      }
    },
    [generateSwapTransactionXDR, signTransaction, submitTransactionToBackend]
  );

  return {
    executeSwap,
    estimateSwap,
    // Utility functions
    toContractAmount,
    fromContractAmount
  };
};
