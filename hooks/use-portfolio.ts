import { useState, useEffect, useMemo } from "react";
import { useWalletBalances } from "@/services/balance.service";
import { useMultipleTokenPrices } from "@/hooks/use-token-price";
import {
  calculatePortfolioData,
  generateChartData,
  generateMockTransactions,
  type PortfolioData,
  type ChartDataPoint,
  type Transaction
} from "@/services/portfolio.service";

export const usePortfolio = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("7D");
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

  // Calculate portfolio data
  const portfolioData: PortfolioData = useMemo(() => {
    if (!walletAssets.length || isLoadingPrices) {
      return {
        totalValue: 0,
        todayChange: 0,
        todayChangePercent: 0,
        assets: []
      };
    }

    return calculatePortfolioData(walletAssets, prices);
  }, [walletAssets, prices, isLoadingPrices]);

  // Generate chart data based on current value and selected period
  const chartData: ChartDataPoint[] = useMemo(() => {
    return generateChartData(selectedPeriod, portfolioData.totalValue);
  }, [selectedPeriod, portfolioData.totalValue]);

  // Mock transaction data
  const transactions: Transaction[] = useMemo(() => {
    return generateMockTransactions();
  }, []);

  const isLoading = isLoadingBalances || isLoadingPrices;
  const hasError = !!balancesError || Object.keys(priceErrors).length > 0;

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  return {
    // Portfolio data
    portfolioData,
    chartData,
    transactions,
    
    // Loading states
    isLoading,
    hasError,
    balancesError,
    priceErrors,
    
    // UI state
    selectedPeriod,
    selectedCategory,
    
    // Actions
    handlePeriodChange,
    handleCategoryChange,
    
    // Raw data for debugging
    walletAssets,
    prices
  };
};