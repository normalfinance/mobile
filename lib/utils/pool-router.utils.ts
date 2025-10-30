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
    return "native";
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

async function fetchPoolContext(
  client: PoolRouterClient,
  tokens: string[]
): Promise<PoolContext> {
  const poolsTx = await client.get_pools(
    { tokens },
    { simulate: true, fee: 1000 }
  );

  if (!poolsTx.result) {
    throw new Error("Pool Router get_pools returned an empty result");
  }

  const poolsResult = poolsTx.result as unknown;
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
    poolAddress
  };
}

async function ensurePoolContext(
  client: PoolRouterClient,
  tokenIn: string,
  tokenOut: string,
  existing?: PoolContext
): Promise<PoolContext> {
  const normalizedIn = normalizeTokenAddress(tokenIn);
  const normalizedOut = normalizeTokenAddress(tokenOut);
  const tokens = sortTokens([normalizedIn, normalizedOut]);

  if (tokensMatch(existing, tokens)) {
    return existing!;
  }

  return fetchPoolContext(client, tokens);
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
  const client = new PoolRouterClient({
    contractId: poolRouterAddress,
    networkPassphrase: networkConfig.networkPassphrase,
    publicKey: networkConfig.testingSource.accountId(),
    rpcUrl: networkConfig.rpcUrl
  });

  const poolContext = await ensurePoolContext(
    client,
    args.tokenIn,
    args.tokenOut,
    args.poolContext
  );

  const tokenInAddress = normalizeTokenAddress(args.tokenIn);
  const tokenOutAddress = normalizeTokenAddress(args.tokenOut);

  const simulation = await client.estimate_swap(
    {
      tokens: poolContext.tokens,
      token_in: tokenInAddress,
      token_out: tokenOutAddress,
      pool_index: poolContext.poolIndex,
      in_amount: args.amountIn,
      risk_reducing: args.riskReducing ?? false
    },
    { simulate: true, fee: 1000 }
  );

  if (simulation.result === undefined || simulation.result === null) {
    throw new Error("Pool Router estimate_swap failed: empty result");
  }

  const amountOut = safeBigInt(simulation.result, "estimate_swap.result");

  return {
    amountOut,
    poolContext
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
  const client = new PoolRouterClient({
    contractId: poolRouterAddress,
    networkPassphrase: networkConfig.networkPassphrase,
    publicKey: sourceAccount.accountId(),
    rpcUrl: networkConfig.rpcUrl
  });

  const poolContext = await ensurePoolContext(
    client,
    swapArgs.tokenIn,
    swapArgs.tokenOut,
    swapArgs.poolContext
  );

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
      out_min: swapArgs.amountOutMin
    },
    { fee: 1000 }
  );

  if (!transaction.built) {
    await transaction.simulate();
  }

  return {
    transaction,
    poolContext
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
