import { useMemo } from "react";

import { useTokenPrice } from "@/hooks/use-token-price";
import {
  useHistoricalPrices,
  type HistoricalPricePoint
} from "@/services/coinmarketcap.service";
import type {
  ChartDataPoint,
  PortfolioPeriod
} from "@/services/portfolio.service";
import { formatNormalToken } from "@/lib/utils/format.utils";

type AssetMetric = {
  label: string;
  value: string;
};

interface UseAssetDetailOptions {
  symbol?: string;
  period: PortfolioPeriod;
  enabled?: boolean;
}

interface UseAssetDetailResult {
  symbol: string;
  baseSymbol: string;
  price: number | null;
  priceTimestamp?: number;
  priceChangePercent: number | null;
  chartData: ChartDataPoint[];
  history: HistoricalPricePoint[];
  latestPoint?: HistoricalPricePoint;
  metrics: AssetMetric[];
  isLoading: boolean;
  isFetching: boolean;
  errors: {
    price?: string;
    historical?: string;
  };
  refreshPrice: () => Promise<void>;
  refetchHistory: () => void;
}

const sanitizeNumber = (value: number | null | undefined): number | null => {
  if (typeof value !== "number") {
    return null;
  }

  return Number.isFinite(value) ? value : null;
};

const getPointPrice = (point?: HistoricalPricePoint): number | null => {
  if (!point) {
    return null;
  }

  if (typeof point.close === "number" && Number.isFinite(point.close)) {
    return point.close;
  }

  if (typeof point.price === "number" && Number.isFinite(point.price)) {
    return point.price;
  }

  return null;
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
      return date.toLocaleDateString("en-US");
  }
};

const buildChartData = (
  history: HistoricalPricePoint[],
  period: PortfolioPeriod
): ChartDataPoint[] => {
  if (!history?.length) {
    return [];
  }

  const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);

  return sorted.map((point) => ({
    timestamp: point.timestamp,
    value: getPointPrice(point) ?? 0,
    date: formatDateForPeriod(point.timestamp, period)
  }));
};

const computeChangePercent = (
  history: HistoricalPricePoint[],
  period: PortfolioPeriod
): number | null => {
  if (!history?.length) {
    return null;
  }

  const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);
  const latest = sorted[sorted.length - 1];

  if (!latest) {
    return null;
  }

  const pickPercentField = () => {
    switch (period) {
      case "1D":
        return sanitizeNumber(latest.percentChange24h);
      case "7D":
        return sanitizeNumber(latest.percentChange7d);
      case "30D":
        return sanitizeNumber(latest.percentChange30d);
      default:
        return null;
    }
  };

  const percentField = pickPercentField();
  if (percentField !== null) {
    return percentField;
  }

  if (sorted.length < 2) {
    return null;
  }

  const firstPrice = getPointPrice(sorted[0]);
  const latestPrice = getPointPrice(latest);

  if (!firstPrice || !latestPrice || firstPrice === 0) {
    return null;
  }

  return ((latestPrice - firstPrice) / firstPrice) * 100;
};

const formatCurrencyCompact = (value: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2
  }).format(value);
};

const formatNumberCompact = (value: number): string => {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2
  }).format(value);
};

const formatPercent = (value: number): string => {
  const fixed = value.toFixed(2);
  if (value > 0) {
    return `+${fixed}%`;
  }
  if (value < 0) {
    return `${fixed}%`;
  }
  return `${fixed}%`;
};

const buildMetrics = (
  latest: HistoricalPricePoint | undefined,
  baseSymbol: string
): AssetMetric[] => {
  if (!latest) {
    return [];
  }

  const metrics: AssetMetric[] = [];

  if (
    typeof latest.marketCap === "number" &&
    Number.isFinite(latest.marketCap)
  ) {
    metrics.push({
      label: "Market Cap",
      value: formatCurrencyCompact(latest.marketCap)
    });
  }

  if (
    typeof latest.volume24h === "number" &&
    Number.isFinite(latest.volume24h)
  ) {
    metrics.push({
      label: "24h Volume",
      value: formatCurrencyCompact(latest.volume24h)
    });
  }

  if (
    typeof latest.circulatingSupply === "number" &&
    Number.isFinite(latest.circulatingSupply)
  ) {
    metrics.push({
      label: "Circulating Supply",
      value: `${formatNumberCompact(latest.circulatingSupply)} ${baseSymbol}`
    });
  }

  if (
    typeof latest.totalSupply === "number" &&
    Number.isFinite(latest.totalSupply)
  ) {
    metrics.push({
      label: "Total Supply",
      value: `${formatNumberCompact(latest.totalSupply)} ${baseSymbol}`
    });
  }

  if (
    typeof latest.percentChange1h === "number" &&
    Number.isFinite(latest.percentChange1h)
  ) {
    metrics.push({
      label: "Change (1h)",
      value: formatPercent(latest.percentChange1h)
    });
  }

  if (
    typeof latest.percentChange24h === "number" &&
    Number.isFinite(latest.percentChange24h)
  ) {
    metrics.push({
      label: "Change (24h)",
      value: formatPercent(latest.percentChange24h)
    });
  }

  return metrics;
};

export const useAssetDetail = ({
  symbol,
  period,
  enabled = true
}: UseAssetDetailOptions): UseAssetDetailResult => {
  const normalizedSymbol = (symbol ?? "").trim().toUpperCase();
  const hasSymbol = normalizedSymbol.length > 0;
  const baseSymbol = hasSymbol
    ? formatNormalToken(normalizedSymbol, "without-n").toUpperCase()
    : "";

  const tokenPrice = useTokenPrice(normalizedSymbol, {
    fetchOnMount: enabled && hasSymbol
  });

  const historicalQuery = useHistoricalPrices({
    symbols: hasSymbol ? [normalizedSymbol] : [],
    period,
    enabled: enabled && hasSymbol
  });

  const history = useMemo(() => {
    if (!hasSymbol) {
      return [] as HistoricalPricePoint[];
    }

    return historicalQuery.data?.[normalizedSymbol] ?? [];
  }, [hasSymbol, historicalQuery.data, normalizedSymbol]);

  const latestPoint = useMemo(() => {
    if (!history.length) {
      return undefined;
    }

    return history.reduce<HistoricalPricePoint | undefined>((latest, point) => {
      if (!latest) {
        return point;
      }

      return point.timestamp > latest.timestamp ? point : latest;
    }, undefined);
  }, [history]);

  const price = useMemo(() => {
    if (tokenPrice.price) {
      const parsed = Number.parseFloat(tokenPrice.price);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    const fallbackPrice = getPointPrice(latestPoint);
    return fallbackPrice ?? null;
  }, [tokenPrice.price, latestPoint]);

  const priceChangePercent = useMemo(() => {
    const change = computeChangePercent(history, period);
    if (change === null) {
      return null;
    }
    if (!Number.isFinite(change)) {
      return null;
    }
    return change;
  }, [history, period]);

  const chartData = useMemo(
    () => buildChartData(history, period),
    [history, period]
  );

  const metrics = useMemo(
    () => buildMetrics(latestPoint, baseSymbol),
    [latestPoint, baseSymbol]
  );

  const errors = useMemo(
    () => ({
      price: tokenPrice.error ?? undefined,
      historical: hasSymbol
        ? historicalQuery.errors?.[normalizedSymbol]
        : undefined
    }),
    [tokenPrice.error, historicalQuery.errors, hasSymbol, normalizedSymbol]
  );

  const isLoading =
    (enabled && hasSymbol && historicalQuery.isLoading) || tokenPrice.loading;

  return {
    symbol: normalizedSymbol,
    baseSymbol,
    price,
    priceTimestamp: tokenPrice.timestamp,
    priceChangePercent,
    chartData,
    history,
    latestPoint,
    metrics,
    isLoading,
    isFetching: historicalQuery.isFetching,
    errors,
    refreshPrice: tokenPrice.refresh,
    refetchHistory: historicalQuery.refetch
  };
};

export type { AssetMetric, UseAssetDetailOptions, UseAssetDetailResult };
