import { DisplayAsset } from "@/lib/types/balance.types";
import { TokenPriceResult } from "@/lib/types/oracle.types";
import type {
  HistoricalPriceMap,
  HistoricalPricePoint
} from "../services/coinmarketcap.service";

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

const getPointPrice = (point: HistoricalPricePoint): number => {
  const close =
    typeof point.close === "number" && Number.isFinite(point.close)
      ? point.close
      : undefined;

  return sanitizeNumber(close ?? point.price ?? 0);
};

const computeAssetChangePercent = (
  history: HistoricalPricePoint[] | undefined,
  period: PortfolioPeriod
): number => {
  if (!history || history.length === 0) {
    return 0;
  }

  const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);
  const latestPoint = sorted[sorted.length - 1];

  if (period === "1D" || period === "7D" || period === "30D") {
    const percentChangeField = (() => {
      switch (period) {
        case "1D":
          return latestPoint.percentChange24h;
        case "7D":
          return latestPoint.percentChange7d;
        case "30D":
          return latestPoint.percentChange30d;
        default:
          return undefined;
      }
    })();

    if (
      typeof percentChangeField === "number" &&
      Number.isFinite(percentChangeField)
    ) {
      return sanitizeNumber(percentChangeField);
    }
  }

  if (sorted.length < 2) {
    return 0;
  }

  const firstPrice = getPointPrice(sorted[0]);
  const latestPrice = getPointPrice(latestPoint);

  if (!firstPrice || firstPrice === 0) {
    return 0;
  }

  return sanitizeNumber(((latestPrice - firstPrice) / firstPrice) * 100);
};

const calculateUsdPrice = (
  assetCode: string,
  prices: Record<string, TokenPriceResult>,
  history: HistoricalPricePoint[] | undefined
): number => {
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
    return getPointPrice(latest);
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
        state.lastPrice = getPointPrice(history[state.index]);
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
  period: PortfolioPeriod
): PortfolioData => {
  const assetsWithPrices: AssetWithPrice[] = [];
  let totalValue = 0;
  let totalChangeUsd = 0;

  assets.forEach((asset) => {
    const balance = sanitizeNumber(parseFloat(asset.balance) || 0);
    const history = historicalPrices[asset.asset_code];
    const usdPrice = calculateUsdPrice(asset.asset_code, prices, history);
    const usdValue = balance * usdPrice;
    const percentChange = computeAssetChangePercent(history, period);

    const sanitizedUsdValue = sanitizeNumber(usdValue);

    totalValue += sanitizedUsdValue;

    totalChangeUsd += sanitizeNumber(sanitizedUsdValue * (percentChange / 100));

    assetsWithPrices.push({
      ...asset,
      usdValue: sanitizedUsdValue,
      usdPrice: sanitizeNumber(usdPrice),
      priceChange24h: sanitizeNumber(percentChange)
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
