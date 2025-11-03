import { Buffer } from "buffer";
import { type Account } from "@stellar/stellar-sdk";
import { type AssembledTransaction } from "@stellar/stellar-sdk/contract";

import { Client as PoolRouterClient } from "../contracts/pool_router";

export interface PoolContext {
  tokens: string[];
  poolIndex: Buffer;
  poolAddress: string;
}

export interface EstimateSwapArgs {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  riskReducing?: boolean;
  poolContext?: PoolContext;
}

export interface SwapEstimateResult {
  amountOut: bigint;
  poolContext: PoolContext;
}

export interface SwapTransactionArgs {
  user: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOutMin: bigint;
  poolContext?: PoolContext;
}

interface EstimateNetworkConfig {
  rpcUrl: string;
  networkPassphrase: string;
  testingSource: Account;
}

interface SwapNetworkConfig {
  networkPassphrase: string;
  rpcUrl: string;
}

type PoolsResultEntry = [Buffer | Uint8Array | string, string];

function normalizeTokenAddress(token: string): string {
  if (token === "XLM") {
    return "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";
  }

  return token;
}

function sortTokens(tokens: string[]): string[] {
  return [...tokens].sort((a, b) => a.localeCompare(b));
}

function tokensMatch(
  context: PoolContext | undefined,
  tokens: string[]
): boolean {
  if (!context) return false;
  if (context.tokens.length !== tokens.length) return false;
  return context.tokens.every((token, index) => token === tokens[index]);
}

function toBuffer(value: Buffer | Uint8Array | string): Buffer {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }

  if (typeof value === "string") {
    return Buffer.from(value, "base64");
  }

  throw new Error(`Unsupported pool index format: ${typeof value}`);
}

interface ReadOnlyNetworkConfig {
  rpcUrl: string;
  networkPassphrase: string;
}

async function fetchPoolContext(
  poolRouterAddress: string,
  tokens: string[],
  networkConfig: ReadOnlyNetworkConfig
): Promise<PoolContext> {
  console.log("fetchPoolContext", tokens);
  if (tokens[1] === "native") {
    tokens[1] = "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";
  }

  const readOnlyClient = new PoolRouterClient({
    contractId: poolRouterAddress,
    networkPassphrase: networkConfig.networkPassphrase,
    rpcUrl: networkConfig.rpcUrl,
  });

  let poolsTx;
  try {
    poolsTx = await readOnlyClient.get_pools(
      { tokens },
      { simulate: true, fee: 1000 }
    );
    console.log("poolsTx", poolsTx);
  } catch (error: any) {
    console.error("❌ Failed to get pools:", error);
    throw new Error(`Failed to get pools: ${error.message}`);
  }

  if (!poolsTx.result) {
    throw new Error("Pool Router get_pools returned an empty result");
  }

  const poolsResult = poolsTx.result as unknown;
  console.log("poolsResult", poolsResult);
  let entries: PoolsResultEntry[] = [];

  if (poolsResult instanceof Map) {
    entries = Array.from(poolsResult.entries()) as PoolsResultEntry[];
  } else if (Array.isArray(poolsResult)) {
    entries = poolsResult as PoolsResultEntry[];
  }

  if (entries.length === 0) {
    throw new Error(`No pools found for tokens: ${tokens.join(", ")}`);
  }

  const [poolIndexRaw, poolAddress] = entries[0];
  const poolIndex = toBuffer(poolIndexRaw);

  return {
    tokens,
    poolIndex,
    poolAddress,
  };
}

async function ensurePoolContext(
  poolRouterAddress: string,
  tokenIn: string,
  tokenOut: string,
  networkConfig: ReadOnlyNetworkConfig,
  existing?: PoolContext
): Promise<PoolContext> {
  const normalizedIn = normalizeTokenAddress(tokenIn);
  const normalizedOut = normalizeTokenAddress(tokenOut);
  const tokens = sortTokens([normalizedIn, normalizedOut]);

  if (tokensMatch(existing, tokens)) {
    return existing!;
  }

  return fetchPoolContext(poolRouterAddress, tokens, networkConfig);
}

function safeBigInt(value: unknown, field: string): bigint {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    try {
      return BigInt(value);
    } catch (error) {
      throw new Error(
        `Failed to convert ${field}="${value}" to BigInt: ${error}`
      );
    }
  }

  if (
    value &&
    typeof (value as { toString: () => string }).toString === "function"
  ) {
    try {
      return BigInt((value as { toString: () => string }).toString());
    } catch (error) {
      throw new Error(`Failed to convert ${field} to BigInt: ${error}`);
    }
  }

  throw new Error(`${field} has unsupported type: ${typeof value}`);
}

export async function estimateSwap(
  poolRouterAddress: string,
  args: EstimateSwapArgs,
  networkConfig: EstimateNetworkConfig
): Promise<SwapEstimateResult> {
  // Create read-only client for fetching pool context (no publicKey needed)
  const readOnlyNetworkConfig: ReadOnlyNetworkConfig = {
    rpcUrl: networkConfig.rpcUrl,
    networkPassphrase: networkConfig.networkPassphrase,
  };

  console.log("Fetching pool context...");

  const poolContext = await ensurePoolContext(
    poolRouterAddress,
    args.tokenIn,
    args.tokenOut,
    readOnlyNetworkConfig,
    args.poolContext
  );

  console.log("poolContext right before simulation", poolContext);

  // Create client WITH publicKey for estimate_swap (needs account context)
  const client = new PoolRouterClient({
    contractId: poolRouterAddress,
    networkPassphrase: networkConfig.networkPassphrase,
    publicKey: networkConfig.testingSource.accountId(),
    rpcUrl: networkConfig.rpcUrl,
  });

  const tokenInAddress = normalizeTokenAddress(args.tokenIn);
  const tokenOutAddress = normalizeTokenAddress(args.tokenOut);

  const baseArgs = {
    tokens: poolContext.tokens, // Already sorted in ensurePoolContext
    token_in: tokenInAddress,
    token_out: tokenOutAddress,
    pool_index: poolContext.poolIndex,
    in_amount: args.amountIn,
  };

  let simulation;
  try {
    // First attempt: simulate without restore
    simulation = await client.estimate_swap(baseArgs, {
      simulate: true,
      fee: 1000,
    });
  } catch (error: any) {
    const errorMessage = error?.message || "";

    // If simulation fails with "restore some contract state" or "Account not found",
    // retry with restore: true to create authorization entries
    if (
      errorMessage.includes("restore some contract state") ||
      errorMessage.includes("Account not found") ||
      errorMessage.includes("account not found")
    ) {
      console.log(
        "⚠️ Simulation failed, retrying with restore: true to create authorization..."
      );
      try {
        // Retry with restore: true
        const tx = await client.estimate_swap(baseArgs, {
          simulate: false,
          fee: 1000,
        });

        // Now simulate with restore: true
        await tx.simulate({ restore: true });
        simulation = tx;
      } catch (restoreError: any) {
        console.error("❌ Failed to restore contract state:", restoreError);
        throw new Error(
          `Failed to estimate swap: ${
            restoreError?.message || "Unknown error"
          }. ` + `The account may need authorization for Soroban tokens.`
        );
      }
    } else {
      throw error;
    }
  }

  if (simulation.result === undefined || simulation.result === null) {
    throw new Error("Pool Router estimate_swap failed: empty result");
  }

  const amountOut = safeBigInt(simulation.result, "estimate_swap.result");

  return {
    amountOut,
    poolContext,
  };
}

export interface BuildSwapResult {
  transaction: AssembledTransaction<bigint>;
  poolContext: PoolContext;
}

export async function buildSwapTransaction(
  poolRouterAddress: string,
  swapArgs: SwapTransactionArgs,
  sourceAccount: Account,
  networkConfig: SwapNetworkConfig
): Promise<BuildSwapResult> {
  // Create read-only client for fetching pool context (no publicKey needed)
  const readOnlyNetworkConfig: ReadOnlyNetworkConfig = {
    rpcUrl: networkConfig.rpcUrl,
    networkPassphrase: networkConfig.networkPassphrase,
  };

  const poolContext = await ensurePoolContext(
    poolRouterAddress,
    swapArgs.tokenIn,
    swapArgs.tokenOut,
    readOnlyNetworkConfig,
    swapArgs.poolContext
  );

  // Create client WITH publicKey for swap transaction (needs account context)
  const client = new PoolRouterClient({
    contractId: poolRouterAddress,
    networkPassphrase: networkConfig.networkPassphrase,
    publicKey: sourceAccount.accountId(),
    rpcUrl: networkConfig.rpcUrl,
  });

  const tokenInAddress = normalizeTokenAddress(swapArgs.tokenIn);
  const tokenOutAddress = normalizeTokenAddress(swapArgs.tokenOut);

  const transaction = await client.swap(
    {
      user: swapArgs.user,
      tokens: poolContext.tokens,
      token_in: tokenInAddress,
      token_out: tokenOutAddress,
      pool_index: poolContext.poolIndex,
      in_amount: swapArgs.amountIn,
      out_min: swapArgs.amountOutMin,
    },
    { fee: 1000 }
  );

  if (!transaction.built) {
    await transaction.simulate();
  }

  return {
    transaction,
    poolContext,
  };
}

export function toContractAmount(amount: string, decimals: number): bigint {
  const num = parseFloat(amount);
  return BigInt(Math.floor(num * Math.pow(10, decimals)));
}

export function fromContractAmount(amount: bigint, decimals: number): string {
  const divisor = BigInt(Math.pow(10, decimals));
  const quotient = Number(amount / divisor);
  const remainder = Number(amount % divisor);

  return (quotient + remainder / Math.pow(10, decimals)).toString();
}
