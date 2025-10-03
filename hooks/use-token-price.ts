import { useState, useEffect, useCallback, useRef } from "react";
import { oracleService } from "@/services/oracle.service";
import type { TokenPriceResult } from "@/lib/types/oracle.types";
import type {
  UseTokenPriceOptions,
  UseTokenPriceReturn,
  UseMultipleTokenPricesOptions,
  UseMultipleTokenPricesReturn
} from "@/lib/types/tokenprice.hook.types";

export const useTokenPrice = (
  asset: string,
  options: UseTokenPriceOptions = {}
): UseTokenPriceReturn => {
  const {
    cacheDuration = 30000,
    refreshInterval = 30000,
    fetchOnMount = true,
    backgroundFetch = false
  } = options;

  const [priceData, setPriceData] = useState<TokenPriceResult>({
    price: "0",
    rawPrice: BigInt(0),
    timestamp: 0,
    cached: false
  });
  const [loading, setLoading] = useState(fetchOnMount);
  const [error, setError] = useState<string | null>(null);

  const refreshIntervalRef = useRef<number | null>(null);
  const isActiveRef = useRef(true);
  const mountedRef = useRef(true);

  const fetchPrice = useCallback(
    async (showLoading = false) => {
      if (!asset || !isActiveRef.current) return;

      try {
        if (showLoading) setLoading(true);
        setError(null);

        const result = await oracleService.getTokenPrice(asset, cacheDuration);

        if (mountedRef.current) {
          setPriceData(result);
          if (result.error) {
            setError(result.error);
          }
        }
      } catch (e) {
        const errorMessage =
          e instanceof Error ? e.message : "Failed to fetch price";
        console.error(`Price fetch error for ${asset}:`, e);

        if (mountedRef.current) {
          setError(errorMessage);
        }
      } finally {
        if (mountedRef.current && showLoading) {
          setLoading(false);
        }
      }
    },
    [asset, cacheDuration]
  );

  const refresh = useCallback(async () => {
    await fetchPrice(true);
  }, [fetchPrice]);

  const clearCache = useCallback(async () => {
    await oracleService.invalidateCache(asset);
    await fetchPrice(true);
  }, [asset, fetchPrice]);

  useEffect(() => {
    if (fetchOnMount && asset) {
      fetchPrice(true);
    }
  }, [asset, fetchOnMount, fetchPrice]);

  useEffect(() => {
    if (refreshInterval > 0 && asset) {
      refreshIntervalRef.current = setInterval(() => {
        if (backgroundFetch || isActiveRef.current) {
          fetchPrice(false);
        }
      }, refreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [asset, refreshInterval, backgroundFetch, fetchPrice]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleVisibilityChange = () => {
        isActiveRef.current = !document.hidden;
      };

      const handleFocus = () => {
        isActiveRef.current = true;
        if (asset && refreshInterval > 0) {
          fetchPrice(false);
        }
      };

      const handleBlur = () => {
        isActiveRef.current = false;
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("focus", handleFocus);
      window.addEventListener("blur", handleBlur);

      return () => {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange
        );
        window.removeEventListener("focus", handleFocus);
        window.removeEventListener("blur", handleBlur);
      };
    }
  }, [asset, refreshInterval, fetchPrice]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  return {
    price: priceData.price,
    rawPrice: priceData.rawPrice,
    timestamp: priceData.timestamp,
    cached: priceData.cached,
    loading,
    error,
    refresh,
    clearCache
  };
};

/**
 * Hook for fetching multiple token prices efficiently
 */

export const useMultipleTokenPrices = (
  assets: string[],
  options: UseMultipleTokenPricesOptions = {}
): UseMultipleTokenPricesReturn => {
  const {
    cacheDuration = 30000,
    refreshInterval = 30000,
    fetchOnMount = true
  } = options;

  const [prices, setPrices] = useState<Record<string, TokenPriceResult>>({});
  const [loading, setLoading] = useState(fetchOnMount);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const refreshIntervalRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const fetchPrices = useCallback(
    async (showLoading = false) => {
      if (!assets.length) return;

      try {
        if (showLoading) setLoading(true);
        setErrors({});

        const results = await oracleService.getMultiplePrices(
          assets,
          cacheDuration
        );

        if (mountedRef.current) {
          setPrices(results);

          const newErrors: Record<string, string> = {};
          Object.entries(results).forEach(([asset, result]) => {
            if (result.error) {
              newErrors[asset] = result.error;
            }
          });
          setErrors(newErrors);
        }
      } catch (e) {
        const errorMessage =
          e instanceof Error ? e.message : "Failed to fetch prices";
        console.error("Multiple prices fetch error:", e);

        if (mountedRef.current) {
          const errorMap: Record<string, string> = {};
          assets.forEach((asset) => {
            errorMap[asset] = errorMessage;
          });
          setErrors(errorMap);
        }
      } finally {
        if (mountedRef.current && showLoading) {
          setLoading(false);
        }
      }
    },
    [assets, cacheDuration]
  );

  const refresh = useCallback(async () => {
    await fetchPrices(true);
  }, [fetchPrices]);

  const clearCache = useCallback(async () => {
    await oracleService.invalidateCache();
    await fetchPrices(true);
  }, [fetchPrices]);

  useEffect(() => {
    if (fetchOnMount && assets.length > 0) {
      fetchPrices(true);
    }
  }, [assets.join(","), fetchOnMount, fetchPrices]);

  useEffect(() => {
    if (refreshInterval > 0 && assets.length > 0) {
      refreshIntervalRef.current = setInterval(() => {
        fetchPrices(false);
      }, refreshInterval);

      return () => {
        if (refreshIntervalRef!.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [assets.join(","), refreshInterval, fetchPrices]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  return {
    prices,
    loading,
    errors,
    refresh,
    clearCache
  };
};
