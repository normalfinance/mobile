import { useState, useMemo } from "react";
import { useWalletBalances } from "@/services/balance.service";
import { useMultipleTokenPrices } from "@/hooks/use-token-price";
import {
  calculatePortfolioData,
  generatePortfolioChartData,
  type PortfolioData,
  type ChartDataPoint,
  type Transaction,
  type PortfolioPeriod
} from "@/services/portfolio.service";
import { useWalletTransactions } from "@/hooks/use-wallet-transactions";
import { useHistoricalPrices } from "../services/coinmarketcap.service";

export const usePortfolio = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<PortfolioPeriod>("7D");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Fetch wallet balances
  const {
    data: walletAssets = [],
    isLoading: isLoadingBalances,
    error: balancesError
  } = useWalletBalances();

  // Get list of asset symbols for price fetching
  const assetSymbols = useMemo(() => {
    return walletAssets.map((asset) => asset.asset_code);
  }, [walletAssets]);

  // Fetch token prices for all assets
  const {
    prices,
    loading: isLoadingPrices,
    errors: priceErrors
  } = useMultipleTokenPrices(assetSymbols);

  const {
    data: historicalPrices,
    isLoading: isLoadingHistorical,
    errors: historicalErrors
  } = useHistoricalPrices({
    symbols: assetSymbols,
    period: selectedPeriod,
    enabled: walletAssets.length > 0
  });

  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!walletAssets.length) {
      return [];
    }

    return generatePortfolioChartData(
      walletAssets,
      selectedPeriod,
      historicalPrices
    );
  }, [historicalPrices, selectedPeriod, walletAssets]);

  // Calculate portfolio data
  const portfolioData: PortfolioData = useMemo(() => {
    if (!walletAssets.length) {
      return {
        totalValue: 0,
        todayChange: 0,
        todayChangePercent: 0,
        assets: []
      };
    }

    return calculatePortfolioData(
      walletAssets,
      prices,
      chartData,
      historicalPrices,
      selectedPeriod
    );
  }, [walletAssets, prices, chartData, historicalPrices, selectedPeriod]);

  const {
    transactions: walletTransactions,
    isLoading: isLoadingTransactions,
    error: transactionsError,
    refetch: refetchTransactions
  } = useWalletTransactions();

  const isLoading =
    isLoadingBalances ||
    isLoadingPrices ||
    isLoadingHistorical ||
    isLoadingTransactions;

  console.log("!!balancesError", balancesError);
  console.log("Object.keys(priceErrors).length > 0 ", Object.keys(priceErrors).length > 0);
  console.log(" Object.keys(historicalErrors).length > 0", Object.keys(historicalErrors).length > 0);
  console.log("Boolean(transactionsError)", Boolean(transactionsError));

  const hasError =
    !!balancesError ||
    Object.keys(priceErrors).length > 0 ||
    Object.keys(historicalErrors).length > 0 ||
    Boolean(transactionsError);

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period as PortfolioPeriod);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  return {
    // Portfolio data
    portfolioData,
    chartData,
    transactions: walletTransactions,

    // Loading states
    isLoading,
    hasError,
    balancesError,
    priceErrors,
    historicalErrors,
    transactionsError,

    // UI state
    selectedPeriod,
    selectedCategory,

    // Actions
    handlePeriodChange,
    handleCategoryChange,

    // Raw data for debugging
    walletAssets,
    prices,
    refetchTransactions
  };
};
