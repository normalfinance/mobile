import { DisplayAsset } from "@/lib/types/balance.types";
import { TokenPriceResult } from "@/lib/types/oracle.types";

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

export const calculatePortfolioData = (
  assets: DisplayAsset[],
  prices: Record<string, TokenPriceResult>
): PortfolioData => {
  let totalValue = 0;
  const assetsWithPrices: AssetWithPrice[] = [];

  assets.forEach((asset) => {
    const priceData = prices[asset.asset_code];
    if (priceData && priceData.price) {
      const usdPrice = parseFloat(priceData.price);
      const balance = parseFloat(asset.balance);
      const usdValue = balance * usdPrice;

      totalValue += usdValue;

      assetsWithPrices.push({
        ...asset,
        usdValue,
        usdPrice,
        priceChange24h: generateMockPriceChange() // Mock data for now
      });
    } else {
      // Include assets without price data as $0 value
      assetsWithPrices.push({
        ...asset,
        usdValue: 0,
        usdPrice: 0,
        priceChange24h: 0
      });
    }
  });

  // Mock today's change - in a real app this would be calculated from historical data
  const todayChange = totalValue * 0.0114; // 1.14% as shown in design
  const todayChangePercent = 1.14;

  return {
    totalValue,
    todayChange,
    todayChangePercent,
    assets: assetsWithPrices
  };
};

export const generateChartData = (
  period: string,
  currentValue: number
): ChartDataPoint[] => {
  const now = Date.now();
  const dataPoints: ChartDataPoint[] = [];

  let points: number;
  let intervalMs: number;

  switch (period) {
    case "1D":
      points = 24;
      intervalMs = 60 * 60 * 1000; // 1 hour
      break;
    case "7D":
      points = 7;
      intervalMs = 24 * 60 * 60 * 1000; // 1 day
      break;
    case "30D":
      points = 30;
      intervalMs = 24 * 60 * 60 * 1000; // 1 day
      break;
    case "180D":
      points = 30;
      intervalMs = 6 * 24 * 60 * 60 * 1000; // 6 days
      break;
    case "365D":
      points = 52;
      intervalMs = 7 * 24 * 60 * 60 * 1000; // 1 week
      break;
    case "All":
      points = 12;
      intervalMs = 30 * 24 * 60 * 60 * 1000; // 1 month
      break;
    default:
      points = 24;
      intervalMs = 60 * 60 * 1000;
  }

  // Generate mock data with some variation
  for (let i = points - 1; i >= 0; i--) {
    const timestamp = now - i * intervalMs;
    const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
    const value = currentValue * (1 + variation);

    dataPoints.push({
      timestamp,
      value: Math.max(0, value),
      date: formatDateForPeriod(timestamp, period)
    });
  }

  return dataPoints;
};

export const generateMockTransactions = (): Transaction[] => {
  const mockTransactions: Transaction[] = [
    {
      id: "tx1",
      type: "receive",
      asset: "nETH",
      amount: 0.5,
      usdValue: 1600.5,
      change: 2.3,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      status: "completed"
    },
    {
      id: "tx2",
      type: "sell",
      asset: "nETH",
      amount: 0.2,
      usdValue: 780.14,
      change: -0.52,
      changeUsd: -4.06,
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
      status: "completed"
    },
    {
      id: "tx3",
      type: "swap",
      asset: "nETH",
      amount: 0.3,
      usdValue: 1175.4,
      change: 0.64,
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      status: "completed"
    },
    {
      id: "tx4",
      type: "buy",
      asset: "nBTC",
      amount: 0.05,
      usdValue: 280.33,
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      status: "pending"
    }
  ];

  return mockTransactions.sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );
};

const formatDateForPeriod = (timestamp: number, period: string): string => {
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

const generateMockPriceChange = (): number => {
  // Generate random price change between -10% and +10%
  return (Math.random() - 0.5) * 20;
};
