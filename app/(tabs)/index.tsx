import React from "react";
import { ScrollView, View } from "react-native";
import { YStack, XStack, Text, Input, Button } from "tamagui";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search } from "lucide-react-native";

import { PortfolioValue } from "@/components/portfolio/PortfolioValue";
import { PortfolioChart } from "@/components/portfolio/PortfolioChart";
import { ActionButtons } from "@/components/portfolio/ActionButtons";
import { AssetList } from "@/components/portfolio/AssetList";
import { TransactionHistory } from "@/components/portfolio/TransactionHistory";
import { usePortfolio } from "@/hooks/use-portfolio";

export default function HomeScreen() {
  const {
    portfolioData,
    chartData,
    transactions,
    isLoading,
    hasError,
    selectedPeriod,
    selectedCategory,
    handlePeriodChange,
    handleCategoryChange
  } = usePortfolio();

  if (hasError) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <YStack
          flex={1}
          padding='$1'
          backgroundColor='$background'
          justifyContent='center'
          alignItems='center'
        >
          <Text
            fontSize='$4'
            color='$red10'
            textAlign='center'
            marginBottom='$4'
          >
            Error loading portfolio data
          </Text>
          <Text fontSize='$3' color='$textSecondary' textAlign='center'>
            Please check your wallet connection and try again
          </Text>
        </YStack>
      </SafeAreaView>
    );
  }

  return (
    <YStack flex={1} backgroundColor='$background'>
      <ScrollView showsVerticalScrollIndicator={false}>
        <YStack padding='$3'>
          {/* Header with search and statistics */}
          <XStack
            justifyContent='space-between'
            alignItems='center'
            marginBottom='$2'
          >
            <XStack
              flex={1}
              alignItems='center'
              backgroundColor='#919EAB1F'
              borderWidth={1}
              borderColor='#919EAB1F'
              borderRadius='$12'
              paddingLeft='$3'
            >
              <Search size={16} color='#737381' />
              <Input
                placeholder='Search'
                backgroundColor='transparent'
                borderWidth={0}
                flex={1}
                fontSize='$3'
              />
            </XStack>
          </XStack>

          {/* Portfolio Value */}
          <View style={{ marginTop: 20 }}>
            <PortfolioValue
              totalValue={portfolioData.totalValue}
              todayChange={portfolioData.todayChange}
              todayChangePercent={portfolioData.todayChangePercent}
              isLoading={isLoading}
            />
          </View>

          {/* Portfolio Chart */}
          <PortfolioChart
            data={chartData}
            selectedPeriod={selectedPeriod}
            onPeriodChange={handlePeriodChange}
            isLoading={isLoading}
          />

          {/* Action Buttons */}
          <ActionButtons
            onSwap={() => console.log("Navigate to swap")}
            onSend={() => console.log("Navigate to send")}
            onBuy={() => console.log("Navigate to buy")}
            onSell={() => console.log("Navigate to sell")}
            onReceive={() => console.log("Navigate to receive")}
          />

          {/* Asset List */}
          <AssetList
            assets={portfolioData.assets}
            selectedCategory={selectedCategory}
            onCategoryChange={handleCategoryChange}
            isLoading={isLoading}
          />

          {/* Transaction History */}
          <TransactionHistory
            transactions={transactions}
            isLoading={isLoading}
          />
        </YStack>
      </ScrollView>
    </YStack>
  );
}
