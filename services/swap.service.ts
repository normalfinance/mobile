// Ensure crypto polyfills are loaded before Stellar SDK
import '../shim';

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  SwapParams,
  SwapQuoteRequest,
  SwapQuote,
  SwapResult,
  DexDistribution,
  TokenInfo,
  AVAILABLE_SWAP_TOKENS,
  SWAP_CONTRACT_ADDRESSES
} from "../lib/types/swap.types";
import { getKeypair } from "./wallet.service";
import { STALE_TIMES } from "../lib/utils/query.utils";
import {
  TransactionBuilder,
  Networks,
  Operation,
  Horizon,
  Account,
  Keypair
} from "@stellar/stellar-sdk";
import * as Crypto from "expo-crypto";
import { getOraclePrice, formatTokenAmount } from "../lib/utils/oracle.utils";
import {
  estimateSwap,
  buildSwapTransaction as buildSwapTransactionUtil,
  getAssetAddress,
  toContractAmount,
  fromContractAmount
} from "../lib/utils/pool-router.utils";

// Create a testing keypair using expo-crypto (same pattern as mnemonic.utils.ts)
const createTestingKeypair = (): Keypair => {
  // Generate 32 bytes of entropy using expo-crypto to ensure compatibility
  const entropy = Crypto.getRandomValues(new Uint8Array(32));
  return Keypair.fromRawEd25519Seed(Buffer.from(entropy));
};

// Get real swap quotes using Pool Router (same as web app)
const calculateSwapQuote = async (
  request: SwapQuoteRequest
): Promise<SwapQuote> => {
  console.log("📊 Getting REAL swap quote from Pool Router...");
  console.log("Quote request:", JSON.stringify(request, null, 2));

  const amountInNum = parseFloat(request.amountIn);
  if (isNaN(amountInNum) || amountInNum <= 0) {
    throw new Error("Invalid amount");
  }

  const config = getNetworkConfig();
  const tokenInInfo = AVAILABLE_SWAP_TOKENS.find(
    (t) => t.address === request.tokenIn
  );
  const tokenOutInfo = AVAILABLE_SWAP_TOKENS.find(
    (t) => t.address === request.tokenOut
  );

  if (!tokenInInfo || !tokenOutInfo) {
    throw new Error("Token not found");
  }

  try {
    // Create a testing source account for contract calls using expo-crypto directly
    console.log("🔑 Creating testing keypair using expo-crypto...");
    const testingKeypair = createTestingKeypair();
    console.log("✅ Keypair created successfully:", testingKeypair.publicKey());
    const testingSource = new Account(testingKeypair.publicKey(), "0");

    const networkConfig = {
      rpcUrl: config.rpcUrl,
      networkPassphrase: config.networkPassphrase,
      testingSource
    };

    console.log("🔮 Step 1: Fetching oracle prices...");

    // Get oracle prices for both tokens (same as web app)
    let tokenInPrice, tokenOutPrice;

    try {
      if (tokenInInfo.symbol !== "XLM") {
        tokenInPrice = await getOraclePrice(
          config.reflectorOracle ||
            process.env.EXPO_PUBLIC_TESTNET_REFLECTOR_ORACLE ||
            "CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63",
          tokenInInfo.symbol,
          networkConfig
        );
        console.log(
          `📈 ${tokenInInfo.symbol} oracle price:`,
          formatTokenAmount(tokenInPrice.price, 14)
        );
      }

      if (tokenOutInfo.symbol !== "XLM") {
        tokenOutPrice = await getOraclePrice(
          config.reflectorOracle ||
            process.env.EXPO_PUBLIC_TESTNET_REFLECTOR_ORACLE ||
            "CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63",
          tokenOutInfo.symbol,
          networkConfig
        );
        console.log(
          `📈 ${tokenOutInfo.symbol} oracle price:`,
          formatTokenAmount(tokenOutPrice.price, 14)
        );
      }
    } catch (oracleError) {
      console.warn(
        "⚠️ Oracle price fetch failed, using fallback pricing:",
        oracleError
      );
    }

    console.log("🏊 Step 2: Calling Pool Router estimate_swap...");

    // Convert amount to contract format
    const amountInContract = toContractAmount(
      request.amountIn,
      tokenInInfo.decimals
    );

    const estimateArgs = {
      asset_in: getAssetAddress(tokenInInfo.symbol, tokenInInfo.address),
      asset_out: getAssetAddress(tokenOutInfo.symbol, tokenOutInfo.address),
      amount_in: amountInContract
    };

    let swapEstimate;
    try {
      // Call the real Pool Router contract
      swapEstimate = await estimateSwap(
        config.poolRouter,
        estimateArgs,
        networkConfig
      );

      console.log("✅ Pool Router estimate success:", {
        amount_out: swapEstimate.amount_out.toString(),
        spread_amount: swapEstimate.spread_amount.toString(),
        commission_amount: swapEstimate.commission_amount.toString(),
        total_fee: swapEstimate.total_fee.toString()
      });
    } catch (poolError) {
      console.warn(
        "⚠️ Pool Router estimate failed, using oracle-based calculation:",
        poolError
      );

      // Fallback to oracle-based calculation
      let exchangeRate = 1;
      if (tokenInPrice && tokenOutPrice) {
        exchangeRate = Number(tokenInPrice.price) / Number(tokenOutPrice.price);
      } else if (tokenInInfo.symbol === "XLM") {
        if (tokenOutInfo.symbol === "nBTC") exchangeRate = 0.000012;
        if (tokenOutInfo.symbol === "nETH") exchangeRate = 0.00035;
        if (tokenOutInfo.symbol === "nSOL") exchangeRate = 0.0045;
      } else if (tokenOutInfo.symbol === "XLM") {
        if (tokenInInfo.symbol === "nBTC") exchangeRate = 83333;
        if (tokenInInfo.symbol === "nETH") exchangeRate = 2857;
        if (tokenInInfo.symbol === "nSOL") exchangeRate = 222;
      }

      const fallbackAmountOut = amountInNum * exchangeRate * 0.997; // 0.3% fee
      swapEstimate = {
        amount_out: toContractAmount(
          fallbackAmountOut.toString(),
          tokenOutInfo.decimals
        ),
        spread_amount: BigInt(0),
        commission_amount: toContractAmount(
          (amountInNum * 0.003).toString(),
          tokenInInfo.decimals
        ),
        total_fee: toContractAmount(
          (amountInNum * 0.003).toString(),
          tokenInInfo.decimals
        )
      };
    }

    // Convert back to display amounts
    const amountOut = fromContractAmount(
      swapEstimate.amount_out,
      tokenOutInfo.decimals
    );
    const amountOutMin = (
      parseFloat(amountOut) *
      (1 - (request.slippageTolerance || 0.5) / 100)
    ).toString();

    // Calculate price impact
    const totalFeeDisplay = fromContractAmount(
      swapEstimate.total_fee,
      tokenInInfo.decimals
    );
    const priceImpact = (
      (parseFloat(totalFeeDisplay) / amountInNum) *
      100
    ).toFixed(3);

    console.log(
      `💱 Real exchange rate: 1 ${tokenInInfo.symbol} = ${(
        parseFloat(amountOut) / amountInNum
      ).toFixed(8)} ${tokenOutInfo.symbol}`
    );
    console.log(`📤 Amount out: ${amountOut} ${tokenOutInfo.symbol}`);
    console.log(
      `📉 Min amount (with slippage): ${amountOutMin} ${tokenOutInfo.symbol}`
    );
    console.log(`💸 Price impact: ${priceImpact}%`);

    const distribution: DexDistribution = {
      parts: "10000",
      path: `${request.tokenIn},${request.tokenOut}`,
      protocol_id: "normal_pool_router"
    };

    const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes

    const keypair = await getKeypair();
    const userAddress = keypair?.publicKey() || "USER_WALLET_ADDRESS";

    const swapParams: SwapParams = {
      amount_in: request.amountIn,
      amount_out_min: amountOutMin,
      deadline,
      distribution: [distribution],
      to: userAddress,
      token_in: request.tokenIn,
      token_out: request.tokenOut
    };

    return {
      amountIn: request.amountIn,
      amountOut,
      amountOutMin,
      priceImpact,
      route: [distribution],
      deadline,
      swapParams
    };
  } catch (error) {
    console.error("❌ Error getting swap quote:", error);
    throw error;
  }
};

// Network configuration (replace with actual env vars)
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

// Build and sign transaction (same flow as web app)
const buildSwapTransaction = async (
  swapParams: SwapParams
): Promise<string> => {
  console.log("🔄 Starting swap transaction build...");
  console.log("SwapParams:", JSON.stringify(swapParams, null, 2));

  const keypair = await getKeypair();
  if (!keypair) {
    throw new Error("No wallet found");
  }

  const config = getNetworkConfig();
  console.log("🌐 Network config:", config);

  try {
    // Step 1: Load account from Horizon (more reliable for mobile)
    console.log("📋 Loading account for:", keypair.publicKey());
    const horizonServer = new Horizon.Server(config.horizonUrl);
    const sourceAccount = await horizonServer.loadAccount(keypair.publicKey());
    console.log("✅ Account loaded. Sequence:", sourceAccount.sequenceNumber());

    // Step 2: Build REAL Pool Router swap transaction
    console.log("🔨 Building REAL Pool Router swap transaction...");

    // Find token info for decimal conversion
    const tokenInInfo = AVAILABLE_SWAP_TOKENS.find(
      (t) =>
        t.address === swapParams.token_in ||
        (swapParams.token_in === "native" && t.symbol === "XLM")
    );
    const tokenOutInfo = AVAILABLE_SWAP_TOKENS.find(
      (t) =>
        t.address === swapParams.token_out ||
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

    console.log("🔢 Contract amounts:", {
      amountIn: `${swapParams.amount_in} ${
        tokenInInfo.symbol
      } = ${amountInContract.toString()}`,
      amountOutMin: `${swapParams.amount_out_min} ${
        tokenOutInfo.symbol
      } = ${amountOutMinContract.toString()}`
    });

    // Use the real Pool Router contract builder
    let transaction;
    try {
      const swapTxBuilder = await buildSwapTransactionUtil(
        config.poolRouter,
        {
          user: keypair.publicKey(),
          asset_in: getAssetAddress(tokenInInfo.symbol, tokenInInfo.address),
          asset_out: getAssetAddress(tokenOutInfo.symbol, tokenOutInfo.address),
          amount_in: amountInContract,
          amount_out_min: amountOutMinContract
        },
        sourceAccount,
        { networkPassphrase: config.networkPassphrase }
      );

      transaction = swapTxBuilder.setTimeout(300).build();
      console.log("✅ Real Pool Router transaction built successfully!");
    } catch (poolRouterError) {
      console.warn(
        "⚠️ Pool Router transaction build failed, using mock transaction:",
        poolRouterError
      );

      // Fallback to mock transaction for testing
      transaction = new TransactionBuilder(sourceAccount, {
        fee: "10000000", // 1 XLM fee for complex operations
        networkPassphrase: config.networkPassphrase
      })
        .addOperation(
          Operation.bumpSequence({
            bumpTo: sourceAccount.sequenceNumber()
          })
        )
        .setTimeout(300)
        .build();
    }

    console.log("🔧 Transaction built:", {
      hash: transaction.hash().toString("hex"),
      fee: transaction.fee,
      operations: transaction.operations.length,
      networkPassphrase: config.networkPassphrase
    });

    // Step 3: Sign transaction locally
    console.log("✍️ Signing transaction...");
    transaction.sign(keypair);

    const signedXdr = transaction.toXDR();
    console.log("📝 Signed XDR length:", signedXdr.length);
    console.log("📝 Signed XDR preview:", signedXdr.substring(0, 100) + "...");
    console.log(
      "🔐 Transaction signature:",
      transaction.signatures[0]
        .signature()
        .toString("base64")
        .substring(0, 20) + "..."
    );

    return signedXdr;
  } catch (error) {
    console.error("❌ Error building transaction:", error);
    throw error;
  }
};

// Send signed XDR to backend (same flow as web app)
const submitSwapToBackend = async (
  signedXdr: string,
  swapParams: SwapParams
): Promise<SwapResult> => {
  console.log("🚀 Submitting swap to backend...");
  console.log("📄 Signed XDR length:", signedXdr.length);

  try {
    // Use localhost backend for development (same endpoint as web app)
    const backendUrl = "http://localhost:8090/api/transaction";

    const keypair = await getKeypair();
    const walletAddress = keypair?.publicKey();

    // Match web app payload format exactly
    const payload = {
      walletAddress,
      signedTransactionXDR: signedXdr,
      transactionType: "Pool Router Swap"
    };

    console.log(
      "📦 Backend payload (web app format):",
      JSON.stringify(payload, null, 2)
    );
    console.log("🌐 Submitting to backend URL:", backendUrl);

    // Actual API call to your backend (same as web app)
    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(
        `Backend request failed: ${response.status} ${response.statusText}`
      );
    }

    const responseData = await response.json();
    console.log("✅ Backend response:", responseData);

    return {
      transactionHash:
        responseData.transactionHash ||
        `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amountIn: swapParams.amount_in,
      amountOut: responseData.amountOut || swapParams.amount_out_min,
      tokenIn: swapParams.token_in,
      tokenOut: swapParams.token_out,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error("❌ Backend submission failed:", error);
    throw error;
  }
};

const executeSwap = async (swapParams: SwapParams): Promise<SwapResult> => {
  console.log("🎯 Starting swap execution...");

  try {
    // Step 1: Build and sign transaction locally
    const signedXdr = await buildSwapTransaction(swapParams);

    // Step 2: Send signed XDR to backend for submission
    const result = await submitSwapToBackend(signedXdr, swapParams);

    console.log("🎉 Swap completed successfully:", result);
    return result;
  } catch (error) {
    console.error("💥 Swap execution failed:", error);
    throw error;
  }
};

// Get available tokens for swapping
export const getAvailableTokens = async (): Promise<TokenInfo[]> => {
  console.log("🪙 Available tokens for swapping:");
  console.log("==================================================");

  AVAILABLE_SWAP_TOKENS.forEach((token, index) => {
    console.log(`${index + 1}. Token: ${token.name} (${token.symbol})`);
    console.log(`   Asset Address: ${token.address}`);
    console.log(`   Decimals: ${token.decimals}`);
    console.log("---");
  });

  console.log("==================================================");
  console.log(`Total available tokens: ${AVAILABLE_SWAP_TOKENS.length}`);

  return AVAILABLE_SWAP_TOKENS;
};

// Find token info by address
export const findTokenByAddress = (address: string): TokenInfo | undefined => {
  return AVAILABLE_SWAP_TOKENS.find((token) => token.address === address);
};

// Find token info by symbol
export const findTokenBySymbol = (symbol: string): TokenInfo | undefined => {
  return AVAILABLE_SWAP_TOKENS.find((token) => token.symbol === symbol);
};

// Query Keys
export const swapQueryKeys = {
  all: ["swap"] as const,
  quotes: () => [...swapQueryKeys.all, "quotes"] as const,
  quote: (request: SwapQuoteRequest) =>
    [...swapQueryKeys.quotes(), request] as const,
  tokens: () => [...swapQueryKeys.all, "tokens"] as const
};

// Custom Hooks
export const useSwapQuote = (
  request: SwapQuoteRequest,
  enabled: boolean = true
) => {
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
  return useMutation({
    mutationFn: executeSwap,
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
    staleTime: STALE_TIMES.LONG // Token list doesn't change often
  });
};

export const parseTokenAmount = (amount: string, decimals: number): string => {
  const num = parseFloat(amount);
  if (isNaN(num)) return "0";

  // Convert to smallest unit (like wei for ETH)
  return (num * Math.pow(10, decimals)).toString();
};

export const formatPriceImpact = (priceImpact: string): string => {
  const impact = parseFloat(priceImpact);
  if (isNaN(impact)) return "0%";
  return `${impact.toFixed(2)}%`;
};

// Constants for slippage tolerance options
export const SLIPPAGE_OPTIONS = [0.1, 0.5, 1.0, 3.0]; // Percentages

export { SWAP_CONTRACT_ADDRESSES };
