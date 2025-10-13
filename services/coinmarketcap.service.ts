import { useQuery } from "@tanstack/react-query";

import { formatNormalToken } from "@/lib/utils/format.utils";
import { createTimeoutSignal, handleHttpError } from "@/lib/utils/http.utils";
import { STALE_TIMES } from "@/lib/utils/query.utils";
import type { PortfolioPeriod } from "@/services/portfolio.service";

const COINMARKETCAP_BASE_URL = "https://pro-api.coinmarketcap.com";
const DEFAULT_TIMEOUT = 15000;
const DEFAULT_CONVERT = "USD";

type StandardPortfolioPeriod = Exclude<PortfolioPeriod, "All"> | "All";

type PeriodConfig = {
  interval: string;
  subtractMs: number;
  count: number;
};

const PERIOD_CONFIG: Record<StandardPortfolioPeriod, PeriodConfig> = {
  "1D": {
    interval: "1h",
    subtractMs: 24 * 60 * 60 * 1000,
    count: 24
  },
  "7D": {
    interval: "1d",
    subtractMs: 7 * 24 * 60 * 60 * 1000,
    count: 7
  },
  "30D": {
    interval: "1d",
    subtractMs: 30 * 24 * 60 * 60 * 1000,
    count: 30
  },
  "180D": {
    interval: "1d",
    subtractMs: 180 * 24 * 60 * 60 * 1000,
    count: 180
  },
  "365D": {
    interval: "1w",
    subtractMs: 365 * 24 * 60 * 60 * 1000,
    count: 52
  },
  All: {
    interval: "1M",
    subtractMs: 5 * 365 * 24 * 60 * 60 * 1000,
    count: 120
  }
};

export interface HistoricalPricePoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type HistoricalPriceMap = Record<string, HistoricalPricePoint[]>;

interface CoinMarketCapHistoricalQuote {
  time_open: string;
  time_close: string;
  quote: {
    [convert: string]: {
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    };
  };
}

interface CoinMarketCapHistoricalResponse {
  status: {
    error_code: number;
    error_message: string | null;
  };
  data?: {
    [symbol: string]: {
      quotes: CoinMarketCapHistoricalQuote[];
    };
  };
}

export interface PricePerformanceEntry {
  price?: number;
  percentChange1h?: number;
  percentChange24h?: number;
  percentChange7d?: number;
  percentChange30d?: number;
  percentChange90d?: number;
  percentChange1y?: number;
  lastUpdated?: string;
}

export type PricePerformanceMap = Record<string, PricePerformanceEntry>;

interface CoinMarketCapPerformanceQuote {
  price: number;
  percent_change_1h?: number;
  percent_change_24h?: number;
  percent_change_7d?: number;
  percent_change_30d?: number;
  percent_change_90d?: number;
  percent_change_1y?: number;
  last_updated?: string;
}

interface CoinMarketCapPerformanceItem {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  last_updated?: string;
  quote: {
    [convert: string]: CoinMarketCapPerformanceQuote;
  };
}

interface CoinMarketCapPerformanceResponse {
  status: {
    error_code: number;
    error_message: string | null;
  };
  data?: {
    [symbol: string]: CoinMarketCapPerformanceItem;
  };
}

export const coinMarketCapQueryKeys = {
  all: ["coinmarketcap"] as const,
  historical: (period: PortfolioPeriod, symbols: readonly string[]) =>
    [
      ...coinMarketCapQueryKeys.all,
      "historical",
      period,
      [...symbols].sort().join("|")
    ] as const,
  performance: (symbols: readonly string[]) =>
    [
      ...coinMarketCapQueryKeys.all,
      "performance",
      [...symbols].sort().join("|")
    ] as const
};

interface FetchHistoricalParams {
  symbol: string;
  period: PortfolioPeriod;
  convert?: string;
}

const ensureApiKey = (): string => {
  const apiKey = process.env.EXPO_PUBLIC_CMC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "CoinMarketCap API key is not configured. Please set EXPO_PUBLIC_CMC_API_KEY."
    );
  }

  return apiKey;
};

const normalizeSymbol = (symbol: string): string =>
  formatNormalToken(symbol, "without-n").toUpperCase();

const buildHistoricalUrl = ({
  symbol,
  period,
  convert
}: FetchHistoricalParams): string => {
  const normalizedPeriod = PERIOD_CONFIG[period as StandardPortfolioPeriod];

  if (!normalizedPeriod) {
    throw new Error(`Unsupported portfolio period: ${period}`);
  }

  const now = Date.now();
  const timeStart = new Date(now - normalizedPeriod.subtractMs).toISOString();
  const params = new URLSearchParams({
    symbol,
    convert: convert ?? DEFAULT_CONVERT,
    time_start: timeStart,
    time_end: new Date(now).toISOString(),
    interval: normalizedPeriod.interval,
    count: String(normalizedPeriod.count)
  });

  return `${COINMARKETCAP_BASE_URL}/v2/cryptocurrency/quotes/historical?${params.toString()}`;
};

const parseHistoricalResponse = (
  json: CoinMarketCapHistoricalResponse,
  symbol: string,
  convert: string
): HistoricalPricePoint[] => {
  if (json.status?.error_code && json.status.error_code !== 0) {
    const message =
      json.status.error_message ||
      `CoinMarketCap request failed with code ${json.status.error_code}`;
    throw new Error(message);
  }

  const symbolData = json.data?.[symbol];
  if (!symbolData) {
    return [];
  }

  return symbolData.quotes
    .map((quote) => {
      const usdQuote = quote.quote?.[convert];

      if (!usdQuote) {
        return null;
      }

      const timestamp = new Date(quote.time_close || quote.time_open).getTime();

      if (!Number.isFinite(timestamp)) {
        return null;
      }

      return {
        timestamp,
        open: usdQuote.open,
        high: usdQuote.high,
        low: usdQuote.low,
        close: usdQuote.close,
        volume: usdQuote.volume
      } satisfies HistoricalPricePoint;
    })
    .filter(Boolean) as HistoricalPricePoint[];
};

const fetchHistoricalQuotes = async ({
  symbol,
  period,
  convert = DEFAULT_CONVERT
}: FetchHistoricalParams): Promise<HistoricalPricePoint[]> => {
  const apiKey = ensureApiKey();
  const url = buildHistoricalUrl({ symbol, period, convert });

  console.log("url in fetchHistoricalQuotes", url);
  console.log("apiKey in fetchHistoricalQuotes", apiKey);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-CMC_PRO_API_KEY": apiKey
      },
      signal: createTimeoutSignal(DEFAULT_TIMEOUT)
    });

    if (!response.ok) {
      console.log("response in fetchHistoricalQuotes", response);
      throw handleHttpError(new Error(response.statusText));
    }

    const json = (await response.json()) as any;
    console.log(
      "json in fetchHistoricalQuotes",
      json.data?.[symbol][0].quotes[0].quote?.[convert]
    );
    return parseHistoricalResponse(json, symbol, convert);
  } catch (error) {
    throw handleHttpError(error);
  }
};

const fetchHistoricalPricesForSymbols = async (
  symbols: readonly string[],
  period: PortfolioPeriod
): Promise<{ data: HistoricalPriceMap; errors: Record<string, string> }> => {
  const uniqueSymbols = Array.from(new Set(symbols.filter(Boolean)));
  const results: HistoricalPriceMap = {};
  const errors: Record<string, string> = {};

  await Promise.allSettled(
    uniqueSymbols.map(async (symbol) => {
      console.log("symbol", symbol);
      const coinSymbol = normalizeSymbol(symbol);
      console.log("coinSymbol", coinSymbol);
      try {
        const points = await fetchHistoricalQuotes({
          symbol: coinSymbol,
          period
        });
        console.log("points", points);

        results[symbol] = points;
      } catch (error) {
        console.log("errorfromfetchHistoricalPricesForSymbols", error);
        const message =
          error instanceof Error
            ? error.message
            : "Unknown error fetching data";
        errors[symbol] = message;
      }
    })
  );

  return { data: results, errors };
};

const buildPerformanceUrl = (symbols: readonly string[]): string => {
  const params = new URLSearchParams({
    symbol: symbols.join(","),
    convert: DEFAULT_CONVERT
  });

  return `${COINMARKETCAP_BASE_URL}/v2/cryptocurrency/price-performance-stats/latest?${params.toString()}`;
};

const parsePerformanceResponse = (
  json: CoinMarketCapPerformanceResponse,
  convert: string
): PricePerformanceMap => {
  if (json.status?.error_code && json.status.error_code !== 0) {
    const message =
      json.status.error_message ||
      `CoinMarketCap performance request failed with code ${json.status.error_code}`;
    throw new Error(message);
  }

  if (!json.data) {
    return {};
  }

  return Object.entries(json.data).reduce<PricePerformanceMap>(
    (acc, [symbol, item]) => {
      const quote = item.quote?.[convert];

      if (!quote) {
        return acc;
      }

      acc[symbol] = {
        price: quote.price,
        percentChange1h: quote.percent_change_1h,
        percentChange24h: quote.percent_change_24h,
        percentChange7d: quote.percent_change_7d,
        percentChange30d: quote.percent_change_30d,
        percentChange90d: quote.percent_change_90d,
        percentChange1y: quote.percent_change_1y,
        lastUpdated: quote.last_updated ?? item.last_updated
      };

      return acc;
    },
    {}
  );
};

const fetchPricePerformanceStats = async (
  symbols: readonly string[]
): Promise<PricePerformanceMap> => {
  if (symbols.length === 0) {
    return {};
  }

  const apiKey = ensureApiKey();
  const normalizedSymbols = Array.from(
    new Set(symbols.map(normalizeSymbol).filter(Boolean))
  );

  if (normalizedSymbols.length === 0) {
    return {};
  }

  const url = buildPerformanceUrl(normalizedSymbols);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-CMC_PRO_API_KEY": apiKey
      },
      signal: createTimeoutSignal(DEFAULT_TIMEOUT)
    });

    if (!response.ok) {
      throw handleHttpError(new Error(response.statusText));
    }

    const json = (await response.json()) as CoinMarketCapPerformanceResponse;
    return parsePerformanceResponse(json, DEFAULT_CONVERT);
  } catch (error) {
    throw handleHttpError(error);
  }
};

interface UseHistoricalPricesOptions {
  symbols: readonly string[];
  period: PortfolioPeriod;
  enabled?: boolean;
}

export const useHistoricalPrices = ({
  symbols,
  period,
  enabled = true
}: UseHistoricalPricesOptions) => {
  const query = useQuery({
    queryKey: coinMarketCapQueryKeys.historical(period, symbols),
    queryFn: () => fetchHistoricalPricesForSymbols(symbols, period),
    enabled: enabled && symbols.length > 0,
    staleTime: STALE_TIMES.SHORT,
    gcTime: STALE_TIMES.LONG
  });

  return {
    data: query.data?.data ?? ({} as HistoricalPriceMap),
    errors: query.data?.errors ?? ({} as Record<string, string>),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch
  };
};

interface UsePricePerformanceStatsOptions {
  symbols: readonly string[];
  enabled?: boolean;
}

export const usePricePerformanceStats = ({
  symbols,
  enabled = true
}: UsePricePerformanceStatsOptions) => {
  const query = useQuery({
    queryKey: coinMarketCapQueryKeys.performance(symbols),
    queryFn: () => fetchPricePerformanceStats(symbols),
    enabled: enabled && symbols.length > 0,
    staleTime: STALE_TIMES.SHORT,
    gcTime: STALE_TIMES.LONG
  });

  return {
    data: query.data ?? ({} as PricePerformanceMap),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch
  };
};

export const coinMarketCapService = {
  fetchHistoricalQuotes,
  fetchHistoricalPricesForSymbols,
  fetchPricePerformanceStats
};
