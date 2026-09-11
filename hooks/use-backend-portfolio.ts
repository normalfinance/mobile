// Home-screen data from the backend instead of CoinMarketCap + on-chain oracle.
//
//   balances + spot prices + 24h change  → GET /api/wallet/portfolio   (Q18)
//   chart                                → GET /api/prices/history     (Q20, public)
//   transactions                         → Horizon (existing fetcher), keyed by
//                                          the Turnkey Stellar address
//
// The returned shape is the one the existing Home components already consume
// (PortfolioData / ChartDataPoint / Transaction from services/portfolio.service),
// so the screen only swaps the hook.

import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type {
  PortfolioAsset,
  PortfolioPayload
} from "@/lib/types/portfolio.types";
import { useSupabaseAuth } from "@/providers/supabase-auth-provider";
import type {
  AssetWithPrice,
  ChartDataPoint,
  PortfolioData,
  PortfolioPeriod
} from "@/services/portfolio.service";
import { useActivityFeed } from "@/hooks/use-activity-feed";

// ---------------------------------------------------------------------------
// GET /api/wallet/portfolio
// ---------------------------------------------------------------------------

type PortfolioResponse = { success: true } & PortfolioPayload & {
    floored?: boolean;
    retryAfterMs?: number;
  };

export const portfolioQueryKey = (userId: string | undefined) =>
  ["backend-portfolio", userId ?? "anonymous"] as const;

const fetchPortfolio = () =>
  apiFetch<PortfolioResponse>("/api/wallet/portfolio", {
    // One of the five routes that honour ?network= (Q1). Belt and braces with
    // the cookie the API client always sends.
    query: { network: "mainnet" }
  });

const ASSET_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  XLM: "Stellar Lumens",
  USDC: "USD Coin"
};

const toNumber = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toAssetWithPrice = (asset: PortfolioAsset): AssetWithPrice => ({
  asset_code: asset.symbol,
  asset_issuer: undefined,
  balance: asset.balance ?? "0",
  // DisplayAsset is Stellar-shaped; only XLM is "native", everything else is a
  // credit asset from the Stellar point of view. Nothing downstream branches on it.
  asset_type: asset.symbol === "XLM" ? "native" : "credit_alphanum4",
  display_name: ASSET_NAMES[asset.symbol] ?? asset.symbol,
  usdValue: toNumber(asset.usdValue),
  usdPrice: toNumber(asset.price),
  priceChange24h: asset.change24h ?? undefined,
  chain: asset.chain,
  address: asset.address
});

const toPortfolioData = (payload: PortfolioPayload | undefined): PortfolioData => {
  if (!payload) {
    return { totalValue: 0, todayChange: 0, todayChangePercent: 0, assets: [] };
  }

  const assets = payload.assets.map(toAssetWithPrice);
  const totalValue = assets.reduce((sum, a) => sum + a.usdValue, 0);

  // Reconstruct yesterday's value per asset from its 24h % change:
  //   valueYesterday = valueNow / (1 + change/100)
  const valueYesterday = assets.reduce((sum, a) => {
    const change = a.priceChange24h;
    if (change === undefined || change === null || change <= -100) {
      return sum + a.usdValue;
    }
    return sum + a.usdValue / (1 + change / 100);
  }, 0);

  const todayChange = totalValue - valueYesterday;
  const todayChangePercent =
    valueYesterday > 0 ? (todayChange / valueYesterday) * 100 : 0;

  return { totalValue, todayChange, todayChangePercent, assets };
};

// ---------------------------------------------------------------------------
// GET /api/prices/history  →  portfolio value over time
// ---------------------------------------------------------------------------

export type HistoryRange = "1d" | "1w" | "1m" | "1y" | "5y" | "all";

export const PERIOD_TO_RANGE: Record<PortfolioPeriod, HistoryRange> = {
  "1D": "1d",
  "7D": "1w",
  "30D": "1m",
  "180D": "1y", // the backend has no 6-month range; 1y is the closest superset
  "365D": "1y",
  All: "all"
};

interface PriceHistoryResponse {
  success: true;
  prices: [number, number][]; // [timestampMs, priceUsd]
  stale?: boolean;
}

export const priceHistoryQueryKey = (symbol: string, range: HistoryRange) =>
  ["price-history", symbol, range] as const;

const fetchPriceHistory = (symbol: string, range: HistoryRange) =>
  apiFetch<PriceHistoryResponse>("/api/prices/history", {
    anonymous: true,
    query: { symbol, range }
  });

/** One asset's price series for the asset detail chart (public route). */
export const usePriceHistory = (symbol: string | undefined, range: HistoryRange) =>
  useQuery({
    queryKey: priceHistoryQueryKey(symbol ?? "", range),
    queryFn: () => fetchPriceHistory(symbol!, range),
    enabled: !!symbol,
    staleTime: 10 * 60_000,
    retry: 1
  });

/** Price at or before `ts` in an ascending [ts, price][] series. */
const priceAt = (series: [number, number][], ts: number): number | null => {
  let lo = 0;
  let hi = series.length - 1;
  let best: number | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid][0] <= ts) {
      best = series[mid][1];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
};

const buildChart = (
  held: { symbol: string; balance: number }[],
  histories: Record<string, [number, number][]>
): ChartDataPoint[] => {
  if (held.length === 0) return [];

  // Use the densest series as the timeline; sample the others at each tick.
  let timeline: [number, number][] = [];
  for (const { symbol } of held) {
    const series = histories[symbol];
    if (series && series.length > timeline.length) timeline = series;
  }
  if (timeline.length === 0) return [];

  return timeline.map(([ts]) => {
    let value = 0;
    for (const { symbol, balance } of held) {
      const series = histories[symbol];
      if (!series) continue;
      const price = priceAt(series, ts) ?? series[0]?.[1] ?? 0;
      value += balance * price;
    }
    return { timestamp: ts, value, date: new Date(ts).toLocaleDateString() };
  });
};

// ---------------------------------------------------------------------------
// The hook
// ---------------------------------------------------------------------------

export const useBackendPortfolio = () => {
  const { user } = useSupabaseAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<PortfolioPeriod>("7D");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const portfolioQuery = useQuery({
    queryKey: portfolioQueryKey(user?.id),
    queryFn: fetchPortfolio,
    enabled: !!user,
    staleTime: 15_000, // server caches for 15s (Q18)
    refetchInterval: 30_000, // web SWR refreshInterval (Q18)
    retry: 1
  });

  const portfolioData = useMemo(
    () => toPortfolioData(portfolioQuery.data),
    [portfolioQuery.data]
  );

  const held = useMemo(
    () =>
      portfolioData.assets
        .map((a) => ({ symbol: a.asset_code, balance: toNumber(a.balance) }))
        .filter((a) => a.balance > 0),
    [portfolioData.assets]
  );

  const range = PERIOD_TO_RANGE[selectedPeriod];

  const historyQueries = useQueries({
    queries: held.map(({ symbol }) => ({
      queryKey: priceHistoryQueryKey(symbol, range),
      queryFn: () => fetchPriceHistory(symbol, range),
      staleTime: 10 * 60_000, // server TTL is 600s for 1d/1w (Q20)
      retry: 1
    }))
  });

  const isLoadingHistory = historyQueries.some((q) => q.isLoading);
  const isFetchingHistory = historyQueries.some((q) => q.isFetching);
  const historyError = historyQueries.find((q) => q.error)?.error as
    | Error
    | undefined;

  // Stable, fixed-length dependency for the memo: React requires the deps
  // array to keep its size, and the number of history queries varies with the
  // number of held assets. A joined key of update timestamps changes exactly
  // when any series changes.
  const historyKey = historyQueries.map((q) => q.dataUpdatedAt).join(",");
  const chartData = useMemo(() => {
    const histories: Record<string, [number, number][]> = {};
    held.forEach(({ symbol }, i) => {
      const prices = historyQueries[i]?.data?.prices;
      if (prices) histories[symbol] = prices;
    });
    return buildChart(held, histories);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held, historyKey]);

  const priceOf = useMemo(() => {
    const prices = new Map(portfolioData.assets.map((a) => [a.asset_code, a.usdPrice]));
    return (symbol: string) => prices.get(symbol) ?? 0;
  }, [portfolioData.assets]);

  const {
    transactions,
    isLoading: isLoadingTransactions,
    error: transactionsError,
    refetch: refetchTransactions
  } = useActivityFeed(priceOf);

  const isLoading =
    portfolioQuery.isLoading ||
    (held.length > 0 && isLoadingHistory) ||
    isLoadingTransactions;

  const error =
    (portfolioQuery.error as Error | null) ??
    historyError ??
    (transactionsError as Error | null) ??
    null;

  return {
    portfolioData,
    chartData,
    transactions,

    isLoading,
    isChartRefreshing: held.length > 0 && !isLoadingHistory && isFetchingHistory,
    hasError: !!portfolioQuery.error, // history/tx failures degrade, they don't block
    errorMessage: error?.message ?? null,
    isStale: portfolioQuery.data?.assets.some((a) => a.status !== "ok") ?? false,

    selectedPeriod,
    selectedCategory,
    handlePeriodChange: (period: string) =>
      setSelectedPeriod(period as PortfolioPeriod),
    handleCategoryChange: setSelectedCategory,

    refetch: portfolioQuery.refetch,
    refetchTransactions
  };
};
