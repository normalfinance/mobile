import { DisplayAsset } from "./balance.types";

import type { PoolContext } from "../utils/pool-router.utils";

export interface DexDistribution {
  parts: string;
  path: string;
  protocol_id: string;
}

export interface SwapParams {
  amountIn: string;
  amountOutMin: string;
  deadline: number;
  distribution: Array<DexDistribution>;
  to: string;
  tokenInSymbol: string;
  tokenOutSymbol: string;
  tokenInAddress: string;
  tokenOutAddress: string;
  poolContext: PoolContext;
}

export interface SwapQuoteRequest {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippageTolerance?: number; // Default 0.5%
}

export interface SwapQuote {
  amountIn: string;
  amountOut: string;
  amountOutMin: string;
  route: DexDistribution[];
  deadline: number;
  swapParams: SwapParams;
}

export interface SwapFormData {
  sellAsset: DisplayAsset | null;
  buyAsset: DisplayAsset | null;
  sellAmount: string;
  buyAmount: string;
  slippageTolerance: number;
}

export interface TransactionResponse {
  result: {
    status: "PENDING" | "SUCCESS" | "FAILED";
    hash?: string;
    latestLedger?: number;
    latestLedgerCloseTime?: string;
  };
}

export interface SwapResult {
  transactionHash: string;
  amountIn: string;
  amountOut: string;
  tokenIn: string;
  tokenOut: string;
  timestamp: number;
  backendResponse?: TransactionResponse;
}

export interface SwapError {
  code: string;
  message: string;
  details?: any;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
}
