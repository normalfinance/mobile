import React from "react";
import { YStack, XStack, Text } from "tamagui";

interface PortfolioValueProps {
  totalValue: number;
  todayChange: number;
  todayChangePercent: number;
  isLoading?: boolean;
}

export const PortfolioValue: React.FC<PortfolioValueProps> = ({
  totalValue,
  todayChange,
  todayChangePercent,
  isLoading = false
}) => {
  const isPositive = todayChange >= 0;
  const changeText = `${isPositive ? "+" : ""}${todayChangePercent.toFixed(2)}%`;
  
  if (isLoading) {
    return (
      <YStack alignItems="flex-start" space="$2" marginBottom="$4">
        <Text fontSize="$2" color="$textSecondary" fontWeight="500">
          Estimated total value
        </Text>
        <Text fontSize="$10" fontWeight="700" color="$textPrimary">
          Loading...
        </Text>
        <XStack alignItems="center" space="$2">
          <Text fontSize="$3" color="$textSecondary">
            Today
          </Text>
          <Text fontSize="$3" color="$textSecondary">
            --
          </Text>
        </XStack>
      </YStack>
    );
  }

  return (
    <YStack alignItems="flex-start" space="$2" marginBottom="$4">
      <Text fontSize="$2" color="$textSecondary" fontWeight="500">
        Estimated total value
      </Text>
      <Text fontSize="$10" fontWeight="700" color="$textPrimary">
        ${totalValue.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}
      </Text>
      <XStack alignItems="center" space="$2">
        <Text fontSize="$3" color="$textSecondary">
          Today
        </Text>
        <Text 
          fontSize="$3" 
          color={isPositive ? "$green10" : "$red10"}
          fontWeight="500"
        >
          {changeText}
        </Text>
      </XStack>
    </YStack>
  );
};