import { useCallback } from "react";
import { Account, Networks } from "@stellar/stellar-sdk";
import { useTransactionOperations } from "./use-transaction";
import { AVAILABLE_SWAP_TOKENS } from "../lib/constants/tokens.constants";
import { SwapParams, SwapResult } from "../lib/types/swap.types";
import { SwapTransactionParams } from "../lib/types/transaction.types";
import { getKeypair } from "../services/wallet.service";
import { formatNormalToken } from "../lib/utils/format.utils";
import {
  Client as PoolRouterClient,
  type SwapDirection as ContractSwapDirection
} from "../lib/contracts/pool_router";

// Swap estimation interfaces
export interface EstimateSwapArgs {
  asset_in: string;
  asset_out: string;
  amount_in: bigint;
}

export interface SwapEstimateResult {
  amount_out: bigint;
  spread_amount: bigint;
}

export type SwapDirection = ContractSwapDirection;

const getPoolRouterAddress = () => {
  const network = process.env.EXPO_PUBLIC_NETWORK || "TESTNET";

  if (network === "MAINNET") {
    return (
      process.env.EXPO_PUBLIC_MAINNET_POOL_ROUTER ||
      "CC3V24ALNMCANOEP2GFSSH4RGOGQXCECDBQISDJQEG23NULP4B4SKKQN"
    );
  } else {
    return (
      process.env.EXPO_PUBLIC_TESTNET_POOL_ROUTER ||
      "CCYQV4LBUROO7IPWMQHGPRSNYM3BXEAHJYU5RAO52TJRG7KP23TY2C63"
    );
  }
};

// Utility functions
function getSwapDirection(
  asset_in: string,
  asset_out: string
): {
  direction: SwapDirection;
} {
  if (asset_in === "XLM") {
    return {
      direction: { tag: "Buy", values: undefined }
    };
  } else {
    return {
      direction: { tag: "Sell", values: undefined }
    };
  }
}

function toContractAmount(amount: string, decimals: number): bigint {
  const num = parseFloat(amount);
  return BigInt(Math.floor(num * Math.pow(10, decimals)));
}

function fromContractAmount(amount: bigint, decimals: number): string {
  const divisor = BigInt(Math.pow(10, decimals));
  const quotient = Number(amount / divisor);
  const remainder = Number(amount % divisor);

  return (quotient + remainder / Math.pow(10, decimals)).toString();
}

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
      args: EstimateSwapArgs,
      networkConfig: {
        rpcUrl: string;
        networkPassphrase: string;
        testingSource: Account;
      }
    ): Promise<SwapEstimateResult> => {
      console.log(`🏊 Calling Pool Router estimate_swap...`);
      console.log("Pool Router Address:", poolRouterAddress);
      console.log("Estimate Args:", {
        asset_in: args.asset_in,
        asset_out: args.asset_out,
        amount_in: args.amount_in.toString()
      });

      const poolRouterClient = new PoolRouterClient({
        contractId: poolRouterAddress,
        networkPassphrase: networkConfig.networkPassphrase,
        publicKey: networkConfig.testingSource.accountId(),
        rpcUrl: networkConfig.rpcUrl
      });

      const { direction } = getSwapDirection(args.asset_in, args.asset_out);

      console.log("🔧 Pool Router parameters:", {
        asset: args.asset_in,
        direction,
        in_amount: args.amount_in.toString()
      });

      const formattedAssetIn = formatNormalToken(args.asset_out, "without-n");
      const formattedAssetOut = formatNormalToken(args.asset_in, "without-n");

      console.log("🔧 Formatted Asset Out:", formattedAssetOut);
      console.log("🔧 Formatted Asset In:", formattedAssetIn);

      const simulation = await poolRouterClient.estimate_swap(
        {
          asset: formattedAssetIn,
          direction: direction as ContractSwapDirection,
          in_amount: args.amount_in
        },
        { simulate: true, fee: 1000 }
      );

      if (!simulation.result) {
        throw new Error("Pool Router estimate failed: empty result");
      }

      const result = simulation.result;
      console.log("✅ Pool Router estimate result:", result);
      console.log("🔍 Result type:", typeof result);

      if (typeof result === "object" && result !== null && "error" in result) {
        const errorMessage = result.error || "Unknown contract error";
        console.error("❌ Pool Router contract error:", errorMessage);
        throw new Error(
          `Pool Router contract error: ${
            errorMessage || "Contract execution failed"
          }`
        );
      }

      if (!Array.isArray(result)) {
        console.error(
          "❌ Unexpected result format - expected array, got:",
          typeof result
        );
        throw new Error(
          `Pool Router returned unexpected format: ${typeof result}. Expected array with [amount_out, spread_amount]`
        );
      }

      console.log("🔍 Result[0]:", result[0], "type:", typeof result[0]);
      console.log("🔍 Result[1]:", result[1], "type:", typeof result[1]);
      console.log("🔍 Result length:", result.length);

      const safeToBigInt = (value: any, name: string): bigint => {
        console.log(`🔧 Converting ${name}:`, value, "type:", typeof value);

        if (value === null || value === undefined) {
          throw new Error(`${name} is null or undefined`);
        }

        if (typeof value === "bigint") {
          return value;
        }

        if (typeof value === "string" || typeof value === "number") {
          try {
            return BigInt(value);
          } catch (error) {
            throw new Error(
              `Failed to convert ${name} "${value}" to BigInt: ${error}`
            );
          }
        }

        if (typeof value === "object" && value.toString) {
          try {
            return BigInt(value.toString());
          } catch (error) {
            throw new Error(
              `Failed to convert ${name} object "${value}" to BigInt: ${error}`
            );
          }
        }

        throw new Error(`${name} has unsupported type: ${typeof value}`);
      };

      return {
        amount_out: safeToBigInt(result[0], "amount_out"),
        spread_amount: safeToBigInt(result[1], "spread_amount")
      };
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
          (t) =>
            t.symbol === swapParams.token_in ||
            (swapParams.token_in === "native" && t.symbol === "XLM")
        );
        const tokenOutInfo = AVAILABLE_SWAP_TOKENS.find(
          (t) =>
            t.symbol === formatNormalToken(swapParams.token_out, "with-n") ||
            (swapParams.token_out === "native" && t.symbol === "XLM")
        );

        if (!tokenInInfo || !tokenOutInfo) {
          throw new Error(
            `Token info not found for swap: ${swapParams.token_in} -> ${swapParams.token_out}`
          );
        }

        // Convert amounts to contract format (with proper decimals)
        const amountInContract = toContractAmount(
          swapParams.amount_in,
          tokenInInfo.decimals
        );
        const amountOutMinContract = toContractAmount(
          swapParams.amount_out_min,
          tokenOutInfo.decimals
        );

        // Create swap transaction parameters
        const swapTxParams: SwapTransactionParams = {
          poolRouterAddress: getPoolRouterAddress(),
          user: keypair.publicKey(),
          asset_in: formatNormalToken(tokenInInfo.symbol, "without-n"),
          asset_out: formatNormalToken(tokenOutInfo.symbol, "without-n"),
          amount_in: amountInContract,
          amount_out_min: amountOutMinContract
        };

        console.log("🔨 Generating transaction XDR...");

        const unsignedXDR = await generateSwapTransactionXDR({
          poolRouterAddress: swapTxParams.poolRouterAddress,
          user: swapTxParams.user,
          asset_in: swapTxParams.asset_in,
          asset_out: swapTxParams.asset_out,
          amount_in: swapTxParams.amount_in,
          amount_out_min: swapTxParams.amount_out_min
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
          amountIn: swapParams.amount_in,
          amountOut: swapParams.amount_out_min, // This would be updated by backend response
          tokenIn: swapParams.token_in,
          tokenOut: swapParams.token_out,
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
    fromContractAmount,
    getSwapDirection
  };
};
