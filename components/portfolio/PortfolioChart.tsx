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
  { label: "ALL", value: "All" }
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
      <YStack space='$4' marginBottom='$4'>
        <YStack
          height={200}
          backgroundColor='$gray2'
          borderRadius='$4'
          justifyContent='center'
          alignItems='center'
        >
          <Text color='$textSecondary'>Loading chart...</Text>
        </YStack>

        {/* Time period selector */}
        <XStack justifyContent='space-between' paddingHorizontal='$2'>
          {periods.map((period) => (
            <Button
              key={period.value}
              size='$2'
              backgroundColor='transparent'
              color='$textSecondary'
              fontSize='$3'
              fontWeight='500'
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
    <YStack marginBottom='$4'>
      {/* Chart container */}
      <YStack height={200} space='$0'>
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
            fontFamily='$numericl'
          >
            {period.label}
          </Button>
        ))}
      </XStack>
    </YStack>
  );
};
