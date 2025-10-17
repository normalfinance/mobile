import { TokenPriceResult } from "./oracle.types";

export interface UseTokenPriceOptions {
  cacheDuration?: number;
  refreshInterval?: number;
  fetchOnMount?: boolean;
  backgroundFetch?: boolean;
}

export interface UseTokenPriceReturn {
  price: string;
  rawPrice: bigint;
  timestamp: number;
  cached: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  clearCache: () => Promise<void>;
}

export interface UseMultipleTokenPricesOptions {
  cacheDuration?: number;
  refreshInterval?: number;
  fetchOnMount?: boolean;
}

export interface UseMultipleTokenPricesReturn {
  prices: Record<string, TokenPriceResult>;
  loading: boolean;
  errors: Record<string, string>;
  refresh: () => Promise<void>;
  clearCache: () => Promise<void>;
}
