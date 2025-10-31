// Ensure crypto polyfills are loaded before Stellar SDK
import "../shim";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  SwapParams,
  SwapQuoteRequest,
  SwapQuote,
  SwapResult,
  DexDistribution,
  TokenInfo
} from "../lib/types/swap.types";
import { AVAILABLE_SWAP_TOKENS } from "../lib/constants/tokens.constants";
import { getKeypair } from "./wallet.service";
import { STALE_TIMES } from "../lib/utils/query.utils";
import { Networks, Account, Horizon } from "@stellar/stellar-sdk";
import { formatNormalToken } from "../lib/utils/format.utils";
import { useSwap } from "../hooks/use-swap";
import { ensureSwapTrustlines } from "../lib/utils/trustline.utils";

// Network configuration helper
const getNetworkConfig = () => {
  const network = process.env.EXPO_PUBLIC_NETWORK || "TESTNET";

  if (network === "MAINNET") {
    return {
      networkPassphrase: Networks.PUBLIC,
      horizonUrl:
        process.env.EXPO_PUBLIC_MAINNET_HORIZON_URL ||
        "https://horizon.stellar.org",
      rpcUrl:
        process.env.EXPO_PUBLIC_MAINNET_RPC_URL ||
        "https://soroban.stellar.org",
      poolRouter:
        process.env.EXPO_PUBLIC_MAINNET_POOL_ROUTER ||
        "CCPHUHQYFOJJ6WQUGUYHHPJYQGFLRQHJJTRJNWQG54MHCHPRFLWQI7SE",
      reflectorOracle:
        process.env.EXPO_PUBLIC_MAINNET_REFLECTOR_ORACLE ||
        "CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M"
    };
  } else {
    return {
      networkPassphrase: Networks.TESTNET,
      horizonUrl:
        process.env.EXPO_PUBLIC_TESTNET_HORIZON_URL ||
        "https://horizon-testnet.stellar.org",
      rpcUrl:
        process.env.EXPO_PUBLIC_TESTNET_RPC_URL ||
        "https://soroban-testnet.stellar.org",
      poolRouter:
        process.env.EXPO_PUBLIC_TESTNET_POOL_ROUTER ||
        "CCYQV4LBUROO7IPWMQHGPRSNYM3BXEAHJYU5RAO52TJRG7KP23TY2C63",
      reflectorOracle:
        process.env.EXPO_PUBLIC_TESTNET_REFLECTOR_ORACLE ||
        "CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63"
    };
  }
};

const createSwapQuoteCalculator = (swapOps: ReturnType<typeof useSwap>) => {
  return async (request: SwapQuoteRequest): Promise<SwapQuote> => {
    console.log("📊 Getting swap quote from Pool Router...");
    console.log("Quote request:", JSON.stringify(request, null, 2));

    const amountInNum = parseFloat(request.amountIn);
    if (isNaN(amountInNum) || amountInNum <= 0) {
      throw new Error("Invalid amount");
    }

    const tokenInInfo = AVAILABLE_SWAP_TOKENS.find(
      (t) => t.symbol === formatNormalToken(request.tokenIn, "with-n")
    );
    const tokenOutInfo = AVAILABLE_SWAP_TOKENS.find(
      (t) => t.symbol === formatNormalToken(request.tokenOut, "with-n")
    );

    console.log("tokenInInfo", tokenInInfo);
    console.log("tokenOutInfo", tokenOutInfo);

    if (!tokenInInfo || !tokenOutInfo) {
      throw new Error("Token not found");
    }

    const config = getNetworkConfig();

    console.log("Network Configuration Check:");
    console.log(
      "  EXPO_PUBLIC_NETWORK:",
      process.env.EXPO_PUBLIC_NETWORK || "TESTNET (default)"
    );
    console.log("  Network Passphrase:", config.networkPassphrase);
    console.log("  Horizon URL:", config.horizonUrl);
    console.log("  RPC URL:", config.rpcUrl);
    console.log("config for swap", config);

    try {
      const testingKeypair = await getKeypair();

      if (!testingKeypair) {
        throw new Error("No wallet found");
      }

      const accountAddress = testingKeypair.publicKey();

      // Load the account first to ensure it exists and get sequence number
      const horizonServer = new Horizon.Server(config.horizonUrl);
      let testingSource: Account;

      try {
        console.log("🔍 Loading account from Horizon:", accountAddress);
        const accountResponse = await horizonServer.loadAccount(accountAddress);
        testingSource = new Account(
          accountResponse.accountId(),
          accountResponse.sequence
        );
        console.log("✅ Account loaded from Horizon for simulation");
        console.log("   Account ID:", accountResponse.accountId());
        console.log("   Sequence:", accountResponse.sequence);
        console.log("   Balances:", accountResponse.balances);
      } catch (error: any) {
        const errorMessage = error?.message || "Unknown error";
        console.error("❌ Could not load account from Horizon:", errorMessage);
        // If account doesn't exist, provide a helpful error message
        if (
          errorMessage.includes("not found") ||
          error?.response?.status === 404
        ) {
          throw new Error(
            `Account not found on Stellar network. Please ensure the account is funded and try again.`
          );
        }
        throw new Error(`Failed to load account: ${errorMessage}`);
      }

      // Ensure trustlines exist for both tokens BEFORE attempting swap
      // This ensures trustlines are added programmatically so swaps don't fail
      // Note: For Soroban tokens, authorization is created automatically during transaction simulation
      console.log("🔧 Ensuring trustlines for swap tokens...");
      console.log(
        `   Token In: ${tokenInInfo.symbol} (${tokenInInfo.address})`
      );
      console.log(
        `   Token Out: ${tokenOutInfo.symbol} (${tokenOutInfo.address})`
      );
      try {
        await ensureSwapTrustlines(
          accountAddress,
          tokenInInfo.address,
          tokenInInfo.symbol,
          tokenOutInfo.address,
          tokenOutInfo.symbol,
          testingSource
        );
        console.log("✅ Trustlines verified/added");
      } catch (error: any) {
        const errorMessage = error?.message || "Unknown error";
        console.error("❌ Error ensuring trustlines:", errorMessage);
        // For Soroban tokens, trustline errors are OK - authorization will be created during tx simulation
        const isSorobanToken =
          tokenInInfo.address.startsWith("C") ||
          tokenOutInfo.address.startsWith("C");
        if (!isSorobanToken) {
          throw new Error(
            `Failed to ensure trustlines before swap: ${errorMessage}`
          );
        }
        console.log(
          "⚠️ Trustline check failed for Soroban token, but authorization will be created during transaction simulation"
        );
      }

      const networkConfig = {
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        testingSource
      };

      console.log("🏊 Calling Pool Router estimate_swap...");

      // Convert amount to contract format using swap operations utilities
      const amountInContract = swapOps.toContractAmount(
        request.amountIn,
        tokenInInfo.decimals
      );

      const estimateArgs = {
        tokenIn: tokenInInfo.address,
        tokenOut: tokenOutInfo.address,
        amountIn: amountInContract
      };

      let swapEstimate;
      try {
        swapEstimate = await swapOps.estimateSwap(
          config.poolRouter,
          estimateArgs,
          networkConfig
        );
      } catch (error: any) {
        const errorMessage = error?.message || "Unknown error";
        console.error("❌ Error estimating swap:", errorMessage);

        // Check if this is an "Account not found" error for Soroban tokens
        // This can happen when the account doesn't have authorization yet
        const isSorobanToken =
          tokenInInfo.address.startsWith("C") ||
          tokenOutInfo.address.startsWith("C");

        if (
          isSorobanToken &&
          (errorMessage.includes("Account not found") ||
            errorMessage.includes("account not found"))
        ) {
          throw new Error(
            `Account authorization for ${tokenInInfo.symbol} or ${tokenOutInfo.symbol} is needed. ` +
              `Soroban token authorization will be created automatically when you execute the swap transaction. ` +
              `Please try executing the swap directly.`
          );
        }

        // Re-throw other errors
        throw error;
      }

      console.log("✅ Pool Router estimate success:", {
        amountOut: swapEstimate.amountOut.toString(),
        poolIndex: swapEstimate.poolContext.poolIndex.toString("base64")
      });

      // Convert back to display amounts using swap operations utilities
      const amountOut = swapOps.fromContractAmount(
        swapEstimate.amountOut,
        tokenOutInfo.decimals
      );
      const amountOutMin = (
        parseFloat(amountOut) *
        (1 - (request.slippageTolerance || 0.5) / 100)
      ).toString();

      console.log(
        `💱 Exchange rate: 1 ${tokenInInfo.symbol} = ${(
          parseFloat(amountOut) / amountInNum
        ).toFixed(8)} ${tokenOutInfo.symbol}`
      );
      console.log(`📤 Amount out: ${amountOut} ${tokenOutInfo.symbol}`);
      console.log(
        `📉 Min amount (with slippage): ${amountOutMin} ${tokenOutInfo.symbol}`
      );

      const distribution: DexDistribution = {
        parts: "10000",
        path: `${request.tokenIn},${request.tokenOut}`,
        protocol_id: "normal_pool_router"
      };

      const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes

      const keypair = await getKeypair();
      const userAddress = keypair?.publicKey() || "USER_WALLET_ADDRESS";

      const swapParams: SwapParams = {
        amountIn: request.amountIn,
        amountOutMin,
        deadline,
        distribution: [distribution],
        to: userAddress,
        tokenInSymbol: tokenInInfo.symbol,
        tokenOutSymbol: tokenOutInfo.symbol,
        tokenInAddress: tokenInInfo.address,
        tokenOutAddress: tokenOutInfo.address,
        poolContext: swapEstimate.poolContext
      };

      return {
        amountIn: request.amountIn,
        amountOut,
        amountOutMin,
        route: [distribution],
        deadline,
        swapParams
      };
    } catch (error) {
      console.error("❌ Error getting swap quote:", error);
      throw error;
    }
  };
};

// Utility functions for token operations
export const getAvailableTokens = async (): Promise<TokenInfo[]> => {
  return AVAILABLE_SWAP_TOKENS;
};

export const findTokenByAddress = (address: string): TokenInfo | undefined => {
  return AVAILABLE_SWAP_TOKENS.find((token) => token.address === address);
};

export const findTokenBySymbol = (symbol: string): TokenInfo | undefined => {
  return AVAILABLE_SWAP_TOKENS.find((token) => token.symbol === symbol);
};

export const parseTokenAmount = (amount: string, decimals: number): string => {
  const num = parseFloat(amount);
  if (isNaN(num)) return "0";
  return (num * Math.pow(10, decimals)).toString();
};

// Query Keys
export const swapQueryKeys = {
  all: ["swap"] as const,
  quotes: () => [...swapQueryKeys.all, "quotes"] as const,
  quote: (request: SwapQuoteRequest) =>
    [...swapQueryKeys.quotes(), request] as const,
  tokens: () => [...swapQueryKeys.all, "tokens"] as const
};

export const useSwapQuote = (
  request: SwapQuoteRequest,
  enabled: boolean = true
) => {
  const swapOps = useSwap();
  const calculateSwapQuote = createSwapQuoteCalculator(swapOps);

  return useQuery({
    queryKey: swapQueryKeys.quote(request),
    queryFn: () => calculateSwapQuote(request),
    enabled:
      enabled &&
      !!request.tokenIn &&
      !!request.tokenOut &&
      !!request.amountIn &&
      parseFloat(request.amountIn) > 0 &&
      request.tokenIn !== request.tokenOut,
    staleTime: STALE_TIMES.SHORT, // 30 seconds - prices change frequently
    retry: 2
  });
};

export const useExecuteSwap = () => {
  const { executeSwap } = useSwap();

  return useMutation({
    mutationFn: (swapParams: SwapParams) => executeSwap(swapParams),
    onSuccess: (result) => {
      console.log("Swap executed successfully:", result);
    },
    onError: (error) => {
      console.error("Swap execution failed:", error);
    }
  });
};

export const useAvailableTokens = () => {
  return useQuery({
    queryKey: swapQueryKeys.tokens(),
    queryFn: getAvailableTokens,
    staleTime: STALE_TIMES.LONG
  });
};
