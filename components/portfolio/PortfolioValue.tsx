import React from "react";
import { YStack, XStack, Text } from "tamagui";
import { ChevronRight } from "lucide-react-native";

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
  const changeText = `${isPositive ? "+" : ""}${todayChangePercent.toFixed(
    2
  )}%`;

  if (isLoading) {
    return (
      <YStack alignItems='flex-start' space='$2' marginBottom='$4' justifyContent='center'>
        <XStack alignItems='center' space='$2' justifyContent='space-between'>
          <Text fontSize='$2' color='#637381' fontWeight='500'>
            Estimated total value
          </Text>
          <Text fontSize='$2' fontWeight='700' color='#11181C'>
            Statistics <ChevronRight size={12} color='#11181C' />
          </Text>
        </XStack>
        <Text fontSize='$10' fontWeight='700' color='#11181C'>
          Loading...
        </Text>
        <XStack alignItems='center' space='$2'>
          <Text fontSize='$3' color='$textSecondary'>
            Today
          </Text>
          <Text fontSize='$3' color='$textSecondary'>
            --
          </Text>
        </XStack>
      </YStack>
    );
  }

  return (
    <YStack alignItems='flex-start' space='$2' marginBottom='$4' justifyContent='center' paddingTop={20}>
      <XStack
        alignItems='center'
        space='$2'
        justifyContent='space-between'
        width='100%'
      >
        <Text fontSize='$2' color='#637381' fontWeight='500'>
          Estimated total value
        </Text>
        <XStack alignItems='center' space='$0' justifyContent='flex-end'>
          <Text fontSize='$2' color='#1C252E' textDecorationLine='underline'>
            Statistics
          </Text>
          <ChevronRight
            size={12}
            color='#1C252E'
            style={{ position: "relative", top: 1 }}
          />
        </XStack>
      </XStack>
      <Text
        fontSize='$10'
        fontWeight='700'
        color='#11181C'
        fontFamily='$numeric'
        marginVertical='$0'
      >
        {/* $20,498.57 */}
        {totalValue.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}
      </Text>
      <XStack alignItems='center' space='$2'>
        <Text fontSize='$2' color='#1C252E'>
          Today
        </Text>
        <Text
          fontSize='$2'
          color={isPositive ? "$green10" : "$red10"}
          fontWeight='500'
        >
          {changeText}
        </Text>
      </XStack>
    </YStack>
  );
};
