import { DisplayAsset } from "@/lib/types/balance.types";

// Display shapes consumed by the Home / asset screens. The values are built by
// hooks/use-backend-portfolio.ts from GET /api/wallet/portfolio; this file
// carries only the types.

export interface AssetWithPrice extends DisplayAsset {
  usdValue: number;
  usdPrice: number;
  priceChange24h?: number;
}

export interface PortfolioData {
  totalValue: number;
  todayChange: number;
  todayChangePercent: number;
  assets: AssetWithPrice[];
}

export interface ChartDataPoint {
  timestamp: number;
  value: number;
  date: string;
}

export type PortfolioPeriod = "1D" | "7D" | "30D" | "180D" | "365D" | "All";

export type TransactionType = "swap" | "send" | "receive" | "buy" | "sell";

export interface Transaction {
  id: string;
  type: TransactionType;
  asset: string;
  amount: number;
  usdValue: number;
  change?: number;
  changeUsd?: number;
  timestamp: Date;
  status: "completed" | "pending" | "failed";
}
