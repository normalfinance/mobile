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
import { Networks, Account } from "@stellar/stellar-sdk";
import { formatNormalToken } from "../lib/utils/format.utils";
import { useSwap } from "../hooks/use-swap";

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
        "CC3V24ALNMCANOEP2GFSSH4RGOGQXCECDBQISDJQEG23NULP4B4SKKQN",
      reflectorOracle:
        process.env.EXPO_PUBLIC_MAINNET_REFLECTOR_ORACLE ||
        "CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN"
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

    if (!tokenInInfo || !tokenOutInfo) {
      throw new Error("Token not found");
    }

    const config = getNetworkConfig();

    try {
      const testingKeypair = await getKeypair();

      if (!testingKeypair) {
        throw new Error("No wallet found");
      }

      const testingSource = new Account(testingKeypair.publicKey(), "0");

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

      const swapEstimate = await swapOps.estimateSwap(
        config.poolRouter,
        estimateArgs,
        networkConfig
      );

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
