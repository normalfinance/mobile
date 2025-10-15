import React from "react";
import { YStack, XStack, Text, Button } from "tamagui";
import { LineChart } from "react-native-gifted-charts";
import { ActivityIndicator, Dimensions } from "react-native";

interface ChartDataPoint {
  timestamp: number;
  value: number;
  date: string;
}

type ChartPeriod = "1D" | "7D" | "30D" | "180D" | "365D" | "All";

interface PortfolioChartProps {
  data: ChartDataPoint[];
  selectedPeriod: ChartPeriod;
  onPeriodChange: (period: ChartPeriod) => void;
  isRefreshing?: boolean;
}

const periods: { label: string; value: ChartPeriod }[] = [
  { label: "1D", value: "1D" },
  { label: "7D", value: "7D" },
  { label: "30D", value: "30D" },
  { label: "180D", value: "180D" },
  { label: "365D", value: "365D" },
  { label: "ALL", value: "All" }
];

export const PortfolioChart: React.FC<PortfolioChartProps> = ({
  data,
  selectedPeriod,
  onPeriodChange,
  isRefreshing = false
}) => {
  const screenWidth = Dimensions.get("window").width;
  const chartWidth = screenWidth - 64; // Account for padding

  // Transform data for react-native-gifted-charts
  const chartData = data.map((point) => ({
    value: point.value,
    label: point.date
  }));

  return (
    <YStack marginBottom='$4'>
      {/* Chart container */}
      <YStack height={200} space='$0' position='relative'>
        <LineChart
          data={chartData}
          width={chartWidth}
          height={180}
          color='#22c55e'
          thickness={2}
          curved
          hideDataPoints
          hideAxesAndRules
          hideYAxisText
          backgroundColor='transparent'
          spacing={chartWidth / Math.max(1, chartData.length - 1)}
          areaChart
          startFillColor='#C5FDE500'
          endFillColor='#ffffff'
          gradientDirection='vertical'
          initialSpacing={0}
          endSpacing={0}
          xAxisLabelTextStyle={{
            color: "transparent", // hide text
            fontSize: 0,
            lineHeight: 0,
            height: 0,
            margin: 0,
            padding: 0
          }}
        />
        {isRefreshing ? (
          <YStack
            position='absolute'
            top={0}
            left={0}
            right={0}
            bottom={0}
            justifyContent='center'
            alignItems='center'
            backgroundColor='rgba(255, 255, 255, 0.6)'
            borderRadius='$4'
          >
            {/* <ActivityIndicator color='#1C252E' size='small' /> */}
          </YStack>
        ) : null}
      </YStack>

      {/* Time period selector */}
      <XStack justifyContent='space-between' paddingHorizontal='$2'>
        {periods.map((period) => (
          <Button
            key={period.value}
            size='$2'
            backgroundColor={
              selectedPeriod === period.value ? "#919EAB1F" : "transparent"
            }
            color={"#1C252E"}
            borderColor={
              selectedPeriod === period.value ? "#919EAB1F" : "transparent"
            }
            fontSize='$2'
            fontWeight='500'
            borderRadius='$8'
            paddingHorizontal='$3'
            onPress={() => onPeriodChange(period.value)}
            disabled={isRefreshing && selectedPeriod !== period.value}
            fontFamily='$numericl'
          >
            {period.label}
          </Button>
        ))}
      </XStack>
    </YStack>
  );
};
