import React, { useMemo, useState } from "react";
import { ScrollView, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAssets } from "expo-asset";
import { SvgUri } from "react-native-svg";
import { YStack, XStack, Text, Button } from "tamagui";
import { ChevronDown, AlertCircle, ArrowUpRight } from "lucide-react-native";

import { AssetIcon } from "@/components/ui/AssetIcon";
import { PortfolioChart } from "@/components/portfolio/PortfolioChart";
import { TransactionHistory } from "@/components/portfolio/TransactionHistory";
import { usePortfolio } from "@/hooks/use-portfolio";
import { AssetDetailSkeleton } from "@/components/ui/skeleton/price-skeletons";
import { assetClassStyles } from "@/constants/assetClassStyles";
import type { AssetClass } from "@/services/prices.service";
import type { PortfolioPeriod } from "@/services/portfolio.service";
import { formatNormalToken } from "@/lib/utils/format.utils";
import { useAssetDetail } from "@/hooks/use-asset-detail";

const DEFAULT_ASSET_CLASS: AssetClass = "Crypto";

const formatCurrency = (amount: number | null): string => {
  if (amount == null || !Number.isFinite(amount)) {
    return "$0.00";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

const getAssetClass = (symbol: string): AssetClass => {
  if (symbol.startsWith("n")) {
    return "Crypto";
  }

  if (symbol === "XLM") {
    return "Crypto";
  }

  return DEFAULT_ASSET_CLASS;
};

const getAssetDisplayName = (
  symbol: string,
  fallback: string,
  walletDisplayName?: string
): string => {
  if (walletDisplayName?.length) {
    return walletDisplayName;
  }

  if (symbol.startsWith("n")) {
    const base = formatNormalToken(symbol, "without-n");
    return `Normal ${base.toUpperCase()}`;
  }

  return fallback;
};

const formatChangeLabel = (period: PortfolioPeriod): string => {
  switch (period) {
    case "1D":
      return "Past 24h";
    case "7D":
      return "Past 7d";
    case "30D":
      return "Past 30d";
    case "180D":
      return "Past 6mo";
    case "365D":
      return "Past year";
    default:
      return "All time";
  }
};

const formatChangePercent = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) {
    return "0.00%";
  }

  const formatted = Math.abs(value).toFixed(2);
  return value >= 0 ? `+${formatted}%` : `-${formatted}%`;
};

const renderErrorBadge = (message?: string) => {
  if (!message) {
    return null;
  }

  return (
    <XStack
      alignItems='center'
      space='$2'
      padding='$2'
      backgroundColor='#FFF3F0'
      borderRadius='$4'
      borderWidth={1}
      borderColor='#FFD0C2'
    >
      <AlertCircle size={14} color='#FF5630' />
      <Text fontSize='$2' color='#FF5630' fontWeight='600'>
        {message}
      </Text>
    </XStack>
  );
};

export default function AssetDetailScreen() {
  const router = useRouter();
  const { symbol } = useLocalSearchParams<{ symbol?: string }>();
  const normalizedSymbol = (symbol ?? "nETH").toString().toUpperCase();
  const [selectedPeriod, setSelectedPeriod] = useState<PortfolioPeriod>("1D");
  const [infoExpanded, setInfoExpanded] = useState(true);
  const [changeIcons] = useAssets([
    require("@svgs/increase.svg"),
    require("@svgs/decrease.svg")
  ]);
  const {
    transactions,
    isLoading: isTransactionsLoading,
    portfolioData
  } = usePortfolio();

  const assetFromPortfolio = useMemo(() => {
    return portfolioData.assets.find(
      (item) => item.asset_code?.toUpperCase() === normalizedSymbol
    );
  }, [portfolioData.assets, normalizedSymbol]);

  const assetClass = useMemo(
    () => getAssetClass(normalizedSymbol),
    [normalizedSymbol]
  );

  const {
    price,
    priceChangePercent,
    chartData,
    metrics,
    isLoading,
    isFetching,
    errors,
    symbol: resolvedSymbol
  } = useAssetDetail({
    symbol: normalizedSymbol,
    period: selectedPeriod,
    enabled: true
  });

  const increaseIcon = changeIcons?.[0];
  const increaseIconUri = increaseIcon?.localUri ?? increaseIcon?.uri;
  const decreaseIcon = changeIcons?.[1];
  const decreaseIconUri = decreaseIcon?.localUri ?? decreaseIcon?.uri;

  const classStyle = assetClassStyles[assetClass];

  const changeIsPositive = (priceChangePercent ?? 0) >= 0;
  const changeColor = changeIsPositive ? "#00C48C" : "#FF5630";

  const assetSymbol = resolvedSymbol || normalizedSymbol;
  const displayName = getAssetDisplayName(
    assetSymbol,
    assetSymbol,
    assetFromPortfolio?.display_name
  );

  const formattedPrice = useMemo(() => formatCurrency(price), [price]);

  const assetTransactions = useMemo(() => {
    const targetSymbol = assetSymbol.toLowerCase();
    return transactions.filter((tx) => tx.asset.toLowerCase() === targetSymbol);
  }, [transactions, assetSymbol]);

  const formattedChangePercent = useMemo(
    () => formatChangePercent(priceChangePercent),
    [priceChangePercent]
  );

  const changeIconUri = changeIsPositive ? increaseIconUri : decreaseIconUri;

  const handleSwapPress = () => {
    router.push({
      pathname: "/(tabs)/invest",
      params: { sellAsset: assetSymbol }
    });
  };

  if (isLoading) {
    return (
      <YStack flex={1} backgroundColor='#FFFFFF'>
        <AssetDetailSkeleton show={true} />
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor='#FFFFFF'>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <YStack space='$6' paddingTop={24}>
          <XStack alignItems='center' space='$4'>
            <XStack space='$3' alignItems='center'>
              <AssetIcon
                symbol={assetSymbol}
                size={48}
                backgroundColor={classStyle?.color}
              />
              <YStack space='$1' flex={1}>
                <XStack
                  alignItems='center'
                  space='$2'
                  justifyContent='space-between'
                >
                  <Text fontSize='$4' fontWeight='700' color='#1C252E'>
                    {displayName}
                  </Text>
                  <Text
                    fontSize='$1'
                    fontWeight='700'
                    color={classStyle?.color}
                    backgroundColor={classStyle?.backgroundColor}
                    paddingVertical={4}
                    paddingHorizontal={8}
                    borderRadius={6}
                  >
                    {assetClass}
                  </Text>
                </XStack>
                <Text
                  fontSize='$2'
                  fontWeight='600'
                  color='#637381'
                  fontFamily='$numeric'
                >
                  {assetSymbol}
                </Text>
              </YStack>
            </XStack>
          </XStack>

          <YStack space='$2'>
            <Text
              fontSize='$8'
              fontWeight='700'
              color='#1C252E'
              fontFamily='$numeric'
            >
              {formattedPrice}
            </Text>
            <XStack alignItems='center' space='$1 '>
              <Text fontSize='$2' fontWeight='400' color={"#1C252E"}>
                {formatChangeLabel(selectedPeriod)}
              </Text>
              <XStack alignItems='center' space='$1'>
                {changeIconUri ? (
                  <SvgUri width={18} height={18} uri={changeIconUri} />
                ) : (
                  <ArrowUpRight size={16} color={changeColor} />
                )}
                <Text
                  fontSize='$2'
                  fontWeight='500'
                  color={"#637381"}
                  fontFamily='$numeric'
                >
                  {formattedChangePercent}
                </Text>
              </XStack>
            </XStack>
            {renderErrorBadge(errors.price)}
          </YStack>

          <PortfolioChart
            data={chartData}
            selectedPeriod={selectedPeriod}
            onPeriodChange={(period) =>
              setSelectedPeriod(period as PortfolioPeriod)
            }
            isRefreshing={isFetching}
          />

          <YStack
            backgroundColor='#F9FAFB'
            borderRadius={24}
            borderWidth={1}
            borderColor='#919EAB1F'
            padding={20}
            space='$3'
          >
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setInfoExpanded((prev) => !prev)}
            >
              <XStack justifyContent='space-between' alignItems='center'>
                <Text fontSize='$3' fontWeight='700' color='#1C252E'>
                  Asset Information
                </Text>
                <ChevronDown
                  size={18}
                  color='#919EAB'
                  style={{
                    transform: [{ rotate: infoExpanded ? "0deg" : "-90deg" }]
                  }}
                />
              </XStack>
            </TouchableOpacity>
            {infoExpanded ? (
              <YStack space='$3'>
                {metrics.length > 0 ? (
                  metrics.map((detail) => {
                    const isChangeMetric = detail.label.includes("Change");
                    const isPositive = detail.value.startsWith("+");
                    const valueWithoutSign = detail.value.replace(/^[+-]/, "");
                    const metricChangeIconUri = isPositive
                      ? increaseIconUri
                      : decreaseIconUri;

                    return (
                      <XStack
                        key={`${assetSymbol}-${detail.label}`}
                        justifyContent='space-between'
                        alignItems='center'
                        paddingVertical='$2'
                      >
                        <Text
                          fontSize='$2'
                          color='#637381'
                          fontWeight='600'
                          fontFamily='$numeric'
                        >
                          {detail.label}
                        </Text>
                        {isChangeMetric ? (
                          <XStack alignItems='center' space='$1'>
                            {metricChangeIconUri && (
                              <SvgUri
                                width={16}
                                height={16}
                                uri={metricChangeIconUri}
                              />
                            )}
                            <Text
                              fontSize='$2'
                              color='#1C252E'
                              fontWeight='600'
                              fontFamily='$numeric'
                              textAlign='right'
                            >
                              {valueWithoutSign}
                            </Text>
                          </XStack>
                        ) : (
                          <Text
                            fontSize='$2'
                            color='#1C252E'
                            fontWeight='600'
                            fontFamily='$numeric'
                            textAlign='right'
                          >
                            {detail.value}
                          </Text>
                        )}
                      </XStack>
                    );
                  })
                ) : (
                  <Text fontSize='$2' color='#637381'>
                    No additional market data available.
                  </Text>
                )}
                {renderErrorBadge(errors.historical)}
              </YStack>
            ) : null}
          </YStack>

          <Button
            backgroundColor='#947BFF33'
            color='#947BFF'
            borderRadius={16}
            fontSize='$3'
            fontWeight='700'
            onPress={handleSwapPress}
          >
            <Text fontSize='$3' fontWeight='700' color='#947BFF'>
              Swap {assetSymbol}
            </Text>
          </Button>

          <TransactionHistory
            transactions={assetTransactions}
            isLoading={isTransactionsLoading}
          />
        </YStack>
      </ScrollView>
    </YStack>
  );
}
