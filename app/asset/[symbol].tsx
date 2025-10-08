import React, { useMemo, useState } from "react";
import { ScrollView, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAssets } from "expo-asset";
import { SvgUri } from "react-native-svg";
import { YStack, XStack, Text, Button } from "tamagui";
import { ArrowRight, ChevronDown, ArrowUpRight } from "lucide-react-native";

import { AssetIcon } from "@/components/ui/AssetIcon";
import { PortfolioChart } from "@/components/portfolio/PortfolioChart";
import { TransactionHistory } from "@/components/portfolio/TransactionHistory";
import { usePortfolio } from "@/hooks/use-portfolio";

type DetailRow = {
  label: string;
  value: string;
};

type ChartPeriod = "1D" | "7D" | "30D" | "180D" | "365D" | "All";

type ChartDataPoint = {
  timestamp: number;
  value: number;
  date: string;
};

type AssetDetail = {
  symbol: string;
  name: string;
  class: AssetClass;
  price: number;
  changePercent: number;
  changeLabel: string;
  chartData: Record<ChartPeriod, ChartDataPoint[]>;
  details: DetailRow[];
};

type AssetClass =
  | "Crypto"
  | "Stock"
  | "Index"
  | "ETF"
  | "Crypto Index"
  | "Commodity";

const assetClassStyles: Record<
  AssetClass,
  { color: string; backgroundColor: string }
> = {
  Crypto: { color: "#00C4A2", backgroundColor: "#2DE9C833" },
  Stock: { color: "#FF6F4C", backgroundColor: "#FF6F4C33" },
  Index: { color: "#947BFF", backgroundColor: "#947BFF33" },
  ETF: { color: "#F8279C", backgroundColor: "#F8279C33" },
  "Crypto Index": { color: "#00AFF7", backgroundColor: "#00AFF733" },
  Commodity: { color: "#D2B100", backgroundColor: "#FFE13D33" }
};

const createChartSeries = (values: number[]): ChartDataPoint[] => {
  const now = Date.now();
  return values.map((value, index) => ({
    timestamp: now - (values.length - index) * 60 * 60 * 1000,
    value,
    date: `${index + 1}`
  }));
};

const assetDetailsMock: Record<string, AssetDetail> = {
  NETH: {
    symbol: "nETH",
    name: "Normal Ethereum",
    class: "Crypto",
    price: 3905.77,
    changePercent: 1.14,
    changeLabel: "Today",
    chartData: {
      "1D": createChartSeries([3825, 3860, 3875, 3890, 3920, 3905, 3905.77]),
      "7D": createChartSeries([3650, 3700, 3750, 3800, 3850, 3900, 3905.77]),
      "30D": createChartSeries([3300, 3400, 3500, 3600, 3700, 3850, 3905.77]),
      "180D": createChartSeries([2800, 3000, 3200, 3400, 3600, 3800, 3905.77]),
      "365D": createChartSeries([2500, 2700, 2900, 3200, 3500, 3800, 3905.77]),
      All: createChartSeries([0.42, 50, 300, 800, 1200, 2500, 3905.77])
    },
    details: [
      { label: "Market Cap:", value: "$469.28B" },
      { label: "24h Volume:", value: "$18B" },
      { label: "FDV:", value: "$530.07B" },
      { label: "Circulating Supply:", value: "120.25M ETH" },
      { label: "Max Supply:", value: "∞" },
      { label: "Launch Year:", value: "2015" },
      { label: "All Time High:", value: "$4,878 (Nov 2021)" },
      { label: "All Time Low:", value: "$0.42 (Oct 2015)" },
      { label: "Category:", value: "Layer-1 Blockchain" }
    ]
  }
};

const defaultAssetDetail: AssetDetail = {
  symbol: "",
  name: "Asset",
  class: "Crypto",
  price: 0,
  changePercent: 0,
  changeLabel: "Today",
  chartData: {
    "1D": createChartSeries([0, 0, 0, 0, 0, 0, 0]),
    "7D": createChartSeries([0, 0, 0, 0, 0, 0, 0]),
    "30D": createChartSeries([0, 0, 0, 0, 0, 0, 0]),
    "180D": createChartSeries([0, 0, 0, 0, 0, 0, 0]),
    "365D": createChartSeries([0, 0, 0, 0, 0, 0, 0]),
    All: createChartSeries([0, 0, 0, 0, 0, 0, 0])
  },
  details: []
};

export default function AssetDetailScreen() {
  const router = useRouter();
  const { symbol } = useLocalSearchParams<{ symbol?: string }>();
  const normalizedSymbol = (symbol ?? "nETH").toString().toUpperCase();
  const asset = assetDetailsMock[normalizedSymbol] ?? defaultAssetDetail;
  const [selectedPeriod, setSelectedPeriod] = useState<ChartPeriod>("1D");
  const [infoExpanded, setInfoExpanded] = useState(true);
  const [changeIcons] = useAssets([
    require("@svgs/increase.svg"),
    require("@svgs/decrease.svg")
  ]);
  const { transactions, isLoading: isTransactionsLoading } = usePortfolio();

  const increaseIcon = changeIcons?.[0];
  const increaseIconUri = increaseIcon?.localUri ?? increaseIcon?.uri;

  const classStyle = assetClassStyles[asset.class];
  const changeIsPositive = asset.changePercent >= 0;
  const changeColor = changeIsPositive ? "#00C48C" : "#FF5630";
  const assetSymbol = asset.symbol || normalizedSymbol;
  const formattedPrice = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(asset.price),
    [asset.price]
  );

  const chartData = useMemo(() => {
    return asset.chartData[selectedPeriod] ?? asset.chartData["1D"];
  }, [asset.chartData, selectedPeriod]);

  const assetTransactions = useMemo(() => {
    const targetSymbol = assetSymbol.toLowerCase();
    return transactions.filter((tx) => tx.asset.toLowerCase() === targetSymbol);
  }, [transactions, assetSymbol]);

  const handleSwapPress = () => {
    router.push({
      pathname: "/(tabs)/invest",
      params: { sellAsset: assetSymbol }
    });
  };

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
                symbol={asset.symbol || normalizedSymbol}
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
                    {asset.name}
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
                    {asset.class}
                  </Text>
                </XStack>
                <Text
                  fontSize='$2'
                  fontWeight='600'
                  color='#637381'
                  fontFamily='$numeric'
                >
                  {asset.symbol || normalizedSymbol}
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
                {asset.changeLabel}
              </Text>
              <XStack alignItems='center' space='$1'>
                {changeIsPositive && increaseIconUri ? (
                  <SvgUri width={18} height={18} uri={increaseIconUri} />
                ) : (
                  <ArrowUpRight size={16} color={changeColor} />
                )}
                <Text
                  fontSize='$2'
                  fontWeight='500'
                  color={"#637381"}
                  fontFamily='$numeric'
                >
                  {`${changeIsPositive ? "+" : "-"}${Math.abs(
                    asset.changePercent
                  ).toFixed(2)}%`}
                </Text>
              </XStack>
            </XStack>
          </YStack>

          <PortfolioChart
            data={chartData}
            selectedPeriod={selectedPeriod}
            onPeriodChange={(period) =>
              setSelectedPeriod(period as ChartPeriod)
            }
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
                {asset.details.map((detail) => (
                  <XStack
                    key={`${asset.symbol}-${detail.label}`}
                    justifyContent='space-between'
                    alignItems='center'
                  >
                    <Text
                      fontSize='$2'
                      color='#637381'
                      fontWeight='600'
                      fontFamily='$numeric'
                    >
                      {detail.label}
                    </Text>
                    <Text
                      fontSize='$2'
                      color='#1C252E'
                      fontWeight='600'
                      fontFamily='$numeric'
                      textAlign='right'
                    >
                      {detail.value}
                    </Text>
                  </XStack>
                ))}
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
