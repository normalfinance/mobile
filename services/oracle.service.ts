import { formatTokenAmount } from "@/lib/utils/oracle.utils";
import { cacheStorage } from "@/lib/utils/storage.utils";
import type {
  PriceData,
  CachedPriceData,
  RateLimitInfo,
  BackgroundUpdateConfig,
  TokenPriceResult,
  OracleServiceConfig,
  CacheStats,
  BackgroundUpdateStatus
} from "@/lib/types/oracle.types";
import {
  fetchLatestQuotes,
  type LatestPricePoint
} from "./coinmarketcap.service";

// Service configuration
const CONFIG: OracleServiceConfig = {
  oracleAddress: "CB4OHJ5KAEY2O5ZOFWOFYOCP6WL5FSZEPO4GVJLW4PBJZRWM4IID7QDF",
  priceDecimals: 7,
  maxRequestsPerMinute: 30,
  defaultCacheDuration: 30000, // 30 seconds
  rateLimitKey: "oracle_rate_limit"
};

// Global state for background updates
let backgroundConfig: BackgroundUpdateConfig | null = null;

const inFlightPriceRequests = new Map<string, Promise<PriceData>>();

// Cache operations
export const getCachedPrice = async (
  cacheKey: string
): Promise<CachedPriceData | null> => {
  try {
    return await cacheStorage.getCacheItem<CachedPriceData>(cacheKey);
  } catch (error) {
    console.error("Failed to get cached price:", error);
    return null;
  }
};

export const setCachedPrice = async (
  cacheKey: string,
  data: CachedPriceData
): Promise<void> => {
  try {
    await cacheStorage.setCacheItem(cacheKey, data);
  } catch (error) {
    console.error("Failed to cache price data:", error);
    throw error;
  }
};

// Rate limiting operations
export const getRateLimitInfo = async (): Promise<RateLimitInfo> => {
  try {
    const data = await cacheStorage.getCacheItem<RateLimitInfo>(
      CONFIG.rateLimitKey
    );
    if (data) {
      return data;
    }
  } catch (error) {
    console.error("Failed to get rate limit info:", error);
  }

  // Default rate limit info
  return {
    count: 0,
    resetTime: Date.now() + 60000
  };
};

export const checkRateLimit = async (): Promise<void> => {
  const rateLimitData = await getRateLimitInfo();
  const now = Date.now();

  if (now > rateLimitData.resetTime) {
    // Reset the counter
    await cacheStorage.setCacheItem(CONFIG.rateLimitKey, {
      count: 0,
      resetTime: now + 60000 // Reset in 1 minute
    });
    return;
  }

  if (rateLimitData.count >= CONFIG.maxRequestsPerMinute) {
    throw new Error("Rate limit exceeded. Please try again later.");
  }
};

export const updateRateLimit = async (): Promise<void> => {
  const rateLimitData = await getRateLimitInfo();
  await cacheStorage.setCacheItem(CONFIG.rateLimitKey, {
    ...rateLimitData,
    count: rateLimitData.count + 1
  });
};

// Oracle price fetching
const toScaledBigInt = (price: number, decimals: number): bigint => {
  const fixed = price.toFixed(decimals);
  const normalized = fixed.replace(".", "");
  return BigInt(normalized);
};

const createPriceDataFromQuote = (
  quote: LatestPricePoint,
  decimals: number
): PriceData => {
  return {
    price: toScaledBigInt(quote.price, decimals),
    timestamp: quote.timestamp
  };
};

export const fetchPriceFromOracle = async (
  asset: string
): Promise<PriceData> => {
  const trimmedAsset = asset.trim();
  const normalizedAsset = trimmedAsset.toUpperCase();
  const requestKey = `${CONFIG.oracleAddress}:${normalizedAsset}`;

  const existingRequest = inFlightPriceRequests.get(requestKey);
  if (existingRequest) {
    return existingRequest;
  }

  const requestPromise = (async () => {
    await checkRateLimit();

    try {
      const { data, errors } = await fetchLatestQuotes([trimmedAsset]);

      const quote = data[trimmedAsset];
      if (!quote) {
        const errorMessage =
          errors[trimmedAsset] ||
          `CoinMarketCap did not return a price for ${normalizedAsset}`;
        throw new Error(errorMessage);
      }

      const priceData = createPriceDataFromQuote(quote, CONFIG.priceDecimals);

      await updateRateLimit();

      return priceData;
    } finally {
      inFlightPriceRequests.delete(requestKey);
    }
  })();

  inFlightPriceRequests.set(requestKey, requestPromise);
  return requestPromise;
};

/**
 * Get price for a single token with caching
 */
export const getTokenPrice = async (
  asset: string,
  cacheDuration = CONFIG.defaultCacheDuration
): Promise<TokenPriceResult> => {
  try {
    const cacheKey = `oracle_price_${asset}`;

    // Try cache first
    const cachedData = await getCachedPrice(cacheKey);
    if (cachedData && Date.now() - cachedData.cachedAt < cacheDuration) {
      return {
        price: cachedData.formattedPrice,
        rawPrice: cachedData.price,
        timestamp: cachedData.timestamp,
        cached: true
      };
    }

    // Fetch fresh data
    const priceData = await fetchPriceFromOracle(asset);
    const formattedPrice = formatTokenAmount(
      priceData.price,
      CONFIG.priceDecimals
    );

    // Cache the result
    await setCachedPrice(cacheKey, {
      ...priceData,
      formattedPrice,
      cachedAt: Date.now()
    });

    return {
      price: formattedPrice,
      rawPrice: priceData.price,
      timestamp: priceData.timestamp,
      cached: false
    };
  } catch (error) {
    console.error(`Failed to fetch price for ${asset}:`, error);
    return {
      price: "0",
      rawPrice: BigInt(0),
      timestamp: Date.now(),
      cached: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
};

/**
 * Get prices for multiple tokens efficiently
 */
export const getMultiplePrices = async (
  assets: string[],
  cacheDuration = CONFIG.defaultCacheDuration
): Promise<Record<string, TokenPriceResult>> => {
  const results: Record<string, TokenPriceResult> = {};

  // First, try to get cached prices for all assets
  const cachePromises = assets.map(async (asset) => {
    const cacheKey = `oracle_price_${asset}`;
    const cached = await getCachedPrice(cacheKey);
    return { asset, cached };
  });

  const cacheResults = await Promise.all(cachePromises);
  const assetsToFetch: string[] = [];

  // Determine which assets need fresh data
  for (const { asset, cached } of cacheResults) {
    if (cached && Date.now() - cached.cachedAt < cacheDuration) {
      results[asset] = {
        price: cached.formattedPrice,
        rawPrice: cached.price,
        timestamp: cached.timestamp,
        cached: true
      };
    } else {
      assetsToFetch.push(asset);
    }
  }

  // Fetch fresh data for remaining assets with rate limiting
  for (const asset of assetsToFetch) {
    try {
      const priceData = await fetchPriceFromOracle(asset);
      const formattedPrice = formatTokenAmount(
        priceData.price,
        CONFIG.priceDecimals
      );

      // Cache the result
      const cacheKey = `oracle_price_${asset}`;
      await setCachedPrice(cacheKey, {
        ...priceData,
        formattedPrice,
        cachedAt: Date.now()
      });

      results[asset] = {
        price: formattedPrice,
        rawPrice: priceData.price,
        timestamp: priceData.timestamp,
        cached: false
      };

      // Small delay between requests to avoid overwhelming the oracle
      if (assetsToFetch.indexOf(asset) < assetsToFetch.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`Failed to fetch price for ${asset}:`, error);
      results[asset] = {
        price: "0",
        rawPrice: BigInt(0),
        timestamp: Date.now(),
        cached: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  return results;
};

/**
 * Start background price updates for specified assets
 */
export const startBackgroundUpdates = (
  assets: string[],
  intervalMs = 30000
): void => {
  stopBackgroundUpdates(); // Stop any existing updates

  backgroundConfig = {
    assets,
    interval: intervalMs,
    isRunning: true,
    intervalId: setInterval(async () => {
      try {
        console.log("Background price update for:", assets);
        await getMultiplePrices(assets, 0); // Force fresh data
      } catch (error) {
        console.error("Background price update failed:", error);
      }
    }, intervalMs)
  };

  console.log(`Started background price updates for ${assets.length} assets`);
};

/**
 * Stop background price updates
 */
export const stopBackgroundUpdates = (): void => {
  if (backgroundConfig?.intervalId) {
    clearInterval(backgroundConfig.intervalId);
    backgroundConfig.isRunning = false;
    console.log("Stopped background price updates");
  }
  backgroundConfig = null;
};

/**
 * Get current background update status
 */
export const getBackgroundUpdateStatus = (): BackgroundUpdateStatus | null => {
  if (!backgroundConfig) return null;

  return {
    isRunning: backgroundConfig.isRunning,
    assets: [...backgroundConfig.assets],
    interval: backgroundConfig.interval
  };
};

/**
 * Invalidate cache for specific asset or all assets
 */
export const invalidateCache = async (asset?: string): Promise<void> => {
  try {
    if (asset) {
      const cacheKey = `oracle_price_${asset}`;
      await cacheStorage.removeCacheItem(cacheKey);
      console.log(`Cache invalidated for ${asset}`);
    } else {
      await cacheStorage.clearKeysWithPrefix("oracle_price_");
      console.log("All oracle cache invalidated");
    }
  } catch (error) {
    console.error("Failed to invalidate cache:", error);
    throw error;
  }
};

/**
 * Get cache statistics
 */
export const getCacheStats = async (): Promise<CacheStats> => {
  try {
    const oracleCacheKeys = await cacheStorage.getKeysWithPrefix(
      "oracle_price_"
    );

    if (oracleCacheKeys.length === 0) {
      return {
        totalCachedAssets: 0,
        oldestCacheTime: null,
        newestCacheTime: null
      };
    }

    const cachePromises = oracleCacheKeys.map(async (key) => {
      const data = await cacheStorage.getCacheItem<CachedPriceData>(key);
      return data ? data.cachedAt : null;
    });

    const cacheTimes = (await Promise.all(cachePromises)).filter(
      Boolean
    ) as number[];

    return {
      totalCachedAssets: oracleCacheKeys.length,
      oldestCacheTime: cacheTimes.length > 0 ? Math.min(...cacheTimes) : null,
      newestCacheTime: cacheTimes.length > 0 ? Math.max(...cacheTimes) : null
    };
  } catch (error) {
    console.error("Failed to get cache stats:", error);
    return {
      totalCachedAssets: 0,
      oldestCacheTime: null,
      newestCacheTime: null
    };
  }
};

// Export service configuration for advanced usage
export const getServiceConfig = (): Readonly<OracleServiceConfig> => ({
  ...CONFIG
});

// Export all functions as a convenience object (optional)
export const oracleService = {
  getTokenPrice,
  getMultiplePrices,
  startBackgroundUpdates,
  stopBackgroundUpdates,
  getBackgroundUpdateStatus,
  invalidateCache,
  getCacheStats,
  getServiceConfig
} as const;
