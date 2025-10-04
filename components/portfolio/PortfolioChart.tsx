import React from "react";
import { YStack, XStack, Text, Button } from "tamagui";
import { LineChart } from "react-native-gifted-charts";
import { Dimensions } from "react-native";

interface ChartDataPoint {
  timestamp: number;
  value: number;
  date: string;
}

interface PortfolioChartProps {
  data: ChartDataPoint[];
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  isLoading?: boolean;
}

const periods = [
  { label: "1D", value: "1D" },
  { label: "7D", value: "7D" },
  { label: "30D", value: "30D" },
  { label: "180D", value: "180D" },
  { label: "365D", value: "365D" },
  { label: "All", value: "All" }
];

export const PortfolioChart: React.FC<PortfolioChartProps> = ({
  data,
  selectedPeriod,
  onPeriodChange,
  isLoading = false
}) => {
  const screenWidth = Dimensions.get("window").width;
  const chartWidth = screenWidth - 64; // Account for padding

  // Transform data for react-native-gifted-charts
  const chartData = data.map((point) => ({
    value: point.value,
    label: point.date
  }));

  if (isLoading) {
    return (
      <YStack space="$4" marginBottom="$4">
        <YStack 
          height={200} 
          backgroundColor="$gray2" 
          borderRadius="$4"
          justifyContent="center"
          alignItems="center"
        >
          <Text color="$textSecondary">Loading chart...</Text>
        </YStack>
        
        {/* Time period selector */}
        <XStack justifyContent="space-between" paddingHorizontal="$2">
          {periods.map((period) => (
            <Button
              key={period.value}
              size="$2"
              backgroundColor="transparent"
              color="$textSecondary"
              fontSize="$3"
              fontWeight="500"
              onPress={() => onPeriodChange(period.value)}
              disabled
            >
              {period.label}
            </Button>
          ))}
        </XStack>
      </YStack>
    );
  }

  return (
    <YStack space="$4" marginBottom="$4">
      {/* Chart container */}
      <YStack height={200} backgroundColor="$background" paddingHorizontal="$2">
        <LineChart
          data={chartData}
          width={chartWidth}
          height={180}
          color="#22c55e"
          thickness={2}
          curved
          hideDataPoints
          hideAxesAndRules
          hideYAxisText
          backgroundColor="transparent"
          spacing={chartWidth / Math.max(1, chartData.length - 1)}
        />
      </YStack>
      
      {/* Time period selector */}
      <XStack justifyContent="space-between" paddingHorizontal="$2">
        {periods.map((period) => (
          <Button
            key={period.value}
            size="$2"
            backgroundColor={selectedPeriod === period.value ? "$gray4" : "transparent"}
            color={selectedPeriod === period.value ? "$textPrimary" : "$textSecondary"}
            fontSize="$3"
            fontWeight="500"
            borderRadius="$3"
            paddingHorizontal="$3"
            paddingVertical="$2"
            onPress={() => onPeriodChange(period.value)}
          >
            {period.label}
          </Button>
        ))}
      </XStack>
    </YStack>
  );
};