import { DisplayAsset } from "@/lib/types/balance.types";
import { TokenPriceResult } from "@/lib/types/oracle.types";
import { formatNormalToken } from "@/lib/utils/format.utils";
import type {
  HistoricalPriceMap,
  HistoricalPricePoint,
  PricePerformanceMap
} from "../services/coinmarketcap.service";

const formatPerformanceKey = (assetCode: string): string => {
  return assetCode.toUpperCase().startsWith("N") && assetCode.length > 1
    ? assetCode.slice(1).toUpperCase()
    : assetCode.toUpperCase();
};

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

const sanitizeNumber = (value: number): number =>
  Number.isFinite(value) ? value : 0;

const computeAssetChangePercent = (
  history: HistoricalPricePoint[] | undefined,
  performance?: number
): number => {
  if (typeof performance === "number" && Number.isFinite(performance)) {
    return performance;
  }

  if (!history || history.length < 2) {
    return 0;
  }

  const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);
  const latest = sorted[sorted.length - 1].close;
  const previous = sorted[sorted.length - 2].close;

  if (!previous || previous === 0) {
    return 0;
  }

  return ((latest - previous) / previous) * 100;
};

const calculateUsdPrice = (
  assetCode: string,
  prices: Record<string, TokenPriceResult>,
  history: HistoricalPricePoint[] | undefined,
  performancePrice?: number
): number => {
  if (typeof performancePrice === "number" && performancePrice >= 0) {
    return performancePrice;
  }

  const priceData = prices[assetCode];

  if (priceData?.price) {
    const parsed = parseFloat(priceData.price);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  if (history && history.length > 0) {
    const latest = history.reduce((prev, current) =>
      current.timestamp > prev.timestamp ? current : prev
    );
    return sanitizeNumber(latest.close);
  }

  return 0;
};

interface AssetHistoryState {
  balance: number;
  history: HistoricalPricePoint[];
  index: number;
  lastPrice: number | undefined;
}

export const generatePortfolioChartData = (
  assets: DisplayAsset[],
  period: PortfolioPeriod,
  historicalPrices: HistoricalPriceMap
): ChartDataPoint[] => {
  const timestamps = new Set<number>();

  assets.forEach((asset) => {
    const history = historicalPrices[asset.asset_code];
    history?.forEach((point) => {
      if (Number.isFinite(point.timestamp)) {
        timestamps.add(point.timestamp);
      }
    });
  });

  const sortedTimestamps = Array.from(timestamps).sort((a, b) => a - b);

  if (sortedTimestamps.length === 0) {
    return [];
  }

  const assetStates: AssetHistoryState[] = assets.map((asset) => {
    const history = [...(historicalPrices[asset.asset_code] ?? [])].sort(
      (a, b) => a.timestamp - b.timestamp
    );

    return {
      balance: sanitizeNumber(parseFloat(asset.balance) || 0),
      history,
      index: 0,
      lastPrice: undefined
    };
  });

  const dataPoints: ChartDataPoint[] = [];

  for (const timestamp of sortedTimestamps) {
    let totalValue = 0;

    assetStates.forEach((state) => {
      const { history } = state;

      while (
        state.index < history.length &&
        history[state.index].timestamp <= timestamp
      ) {
        state.lastPrice = sanitizeNumber(history[state.index].close);
        state.index += 1;
      }

      if (state.lastPrice !== undefined) {
        totalValue += state.balance * state.lastPrice;
      }
    });

    dataPoints.push({
      timestamp,
      value: sanitizeNumber(totalValue),
      date: formatDateForPeriod(timestamp, period)
    });
  }

  return dataPoints;
};

export const calculatePortfolioData = (
  assets: DisplayAsset[],
  prices: Record<string, TokenPriceResult>,
  chartData: ChartDataPoint[],
  historicalPrices: HistoricalPriceMap,
  performanceStats: PricePerformanceMap
): PortfolioData => {
  const assetsWithPrices: AssetWithPrice[] = [];
  let totalValue = 0;
  let totalChangeUsd = 0;

  assets.forEach((asset) => {
    const balance = sanitizeNumber(parseFloat(asset.balance) || 0);
    const history = historicalPrices[asset.asset_code];
    const performanceEntry =
      performanceStats[formatPerformanceKey(asset.asset_code)];
    const usdPrice = calculateUsdPrice(
      asset.asset_code,
      prices,
      history,
      performanceEntry?.price
    );
    const usdValue = balance * usdPrice;
    const priceChange24h = computeAssetChangePercent(
      history,
      performanceEntry?.percentChange24h
    );

    const sanitizedUsdValue = sanitizeNumber(usdValue);

    totalValue += sanitizedUsdValue;

    if (performanceEntry?.percentChange24h != null) {
      totalChangeUsd += sanitizeNumber(
        sanitizedUsdValue * (priceChange24h / 100)
      );
    }

    assetsWithPrices.push({
      ...asset,
      usdValue: sanitizedUsdValue,
      usdPrice: sanitizeNumber(usdPrice),
      priceChange24h: sanitizeNumber(priceChange24h)
    });
  });

  const latestValue = sanitizeNumber(totalValue);
  const todayChange = sanitizeNumber(totalChangeUsd);
  const previousValue = sanitizeNumber(latestValue - todayChange);

  const todayChangePercent =
    previousValue > 0 ? sanitizeNumber((todayChange / previousValue) * 100) : 0;

  return {
    totalValue: latestValue,
    todayChange,
    todayChangePercent,
    assets: assetsWithPrices
  };
};

const formatDateForPeriod = (
  timestamp: number,
  period: PortfolioPeriod
): string => {
  const date = new Date(timestamp);

  switch (period) {
    case "1D":
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit"
      });
    case "7D":
    case "30D":
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      });
    case "180D":
    case "365D":
    case "All":
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit"
      });
    default:
      return date.toLocaleDateString();
  }
};
