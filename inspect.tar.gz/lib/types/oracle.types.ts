export interface PriceData {
  price: bigint;
  timestamp: number;
}

export interface CachedPriceData extends PriceData {
  cachedAt: number;
  formattedPrice: string;
}

export interface RateLimitInfo {
  count: number;
  resetTime: number;
}

export interface BackgroundUpdateConfig {
  assets: string[];
  interval: number;
  isRunning: boolean;
  intervalId?: number | null;
}

export interface TokenPriceResult {
  price: string;
  rawPrice: bigint;
  timestamp: number;
  cached: boolean;
  error?: string;
}

export interface OracleServiceConfig {
  oracleAddress: string;
  priceDecimals: number;
  maxRequestsPerMinute: number;
  defaultCacheDuration: number;
  rateLimitKey: string;
}

export interface CacheStats {
  totalCachedAssets: number;
  oldestCacheTime: number | null;
  newestCacheTime: number | null;
}

export interface BackgroundUpdateStatus {
  isRunning: boolean;
  assets: string[];
  interval: number;
}

export interface NetworkConfig {
  rpcUrl: string;
  networkPassphrase: string;
  testingSource: any;
}
