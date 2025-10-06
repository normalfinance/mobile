import React, { useState } from "react";
import { FlatList } from "react-native";
import { YStack, XStack, Text, Button, Circle, Tabs } from "tamagui";
import { DisplayAsset } from "@/lib/types/balance.types";

interface AssetWithPrice extends DisplayAsset {
  usdValue: number;
  usdPrice: number;
  priceChange24h?: number;
}

interface AssetListProps {
  assets: AssetWithPrice[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  isLoading?: boolean;
}

const categories = [
  { label: "All Assets", value: "all" },
  { label: "Crypto", value: "crypto" },
  { label: "DWMs", value: "dwms" },
  { label: "Indexes", value: "indexes" },
  { label: "Stocks", value: "stocks" }
];

// Token icon mapping based on symbol (reused from AssetSelector)
const getTokenIcon = (symbol: string) => {
  const iconMap: Record<string, { bgColor: string; icon: string }> = {
    XLM: { bgColor: "$black", icon: "✦" },
    nBTC: { bgColor: "#f7931a", icon: "₿" },
    nETH: { bgColor: "#627eea", icon: "Ξ" },
    nSOL: { bgColor: "#9945ff", icon: "S" },
    BTC: { bgColor: "#f7931a", icon: "₿" },
    ETH: { bgColor: "#627eea", icon: "Ξ" },
    SOL: { bgColor: "#9945ff", icon: "S" },
    nUSD: { bgColor: "$green9", icon: "$" },
    nTESLA: { bgColor: "$red9", icon: "T" },
    "nS&P500": { bgColor: "$blue9", icon: "S" }
  };
  return iconMap[symbol] || { bgColor: "$purple500", icon: symbol.charAt(0) };
};

const AssetItem: React.FC<{ asset: AssetWithPrice }> = ({ asset }) => {
  const tokenIcon = getTokenIcon(asset.asset_code);
  const isPositive = (asset.priceChange24h || 0) >= 0;

  return (
    <XStack
      alignItems='center'
      justifyContent='space-between'
      paddingVertical='$3'
      paddingHorizontal='$2'
    >
      <XStack alignItems='center' space='$3' flex={1}>
        <Circle size={40} backgroundColor={tokenIcon.bgColor}>
          <Text fontSize='$4' fontWeight='700' color='white'>
            {tokenIcon.icon}
          </Text>
        </Circle>
        <YStack alignItems='flex-start' flex={1}>
          <Text fontSize='$4' fontWeight='600' color='$textPrimary'>
            {asset.display_name}
          </Text>
          <Text fontSize='$3' color='$gray11'>
            {parseFloat(asset.balance).toFixed(4)} {asset.asset_code}
          </Text>
        </YStack>
      </XStack>

      <YStack alignItems='flex-end'>
        <Text fontSize='$4' fontWeight='600' color='$textPrimary'>
          ${asset.usdValue.toFixed(2)}
        </Text>
        {asset.priceChange24h !== undefined && (
          <XStack alignItems='center' space='$1'>
            <Text fontSize='$2' color='$gray11'>
              ${asset.usdPrice.toFixed(2)}
            </Text>
            <Text
              fontSize='$2'
              color={isPositive ? "$green10" : "$red10"}
              fontWeight='500'
            >
              {isPositive ? "+" : ""}
              {asset.priceChange24h.toFixed(2)}%
            </Text>
          </XStack>
        )}
      </YStack>
    </XStack>
  );
};

export const AssetList: React.FC<AssetListProps> = ({
  assets,
  selectedCategory,
  onCategoryChange,
  isLoading = false
}) => {
  // Filter assets based on selected category
  const filteredAssets = React.useMemo(() => {
    if (selectedCategory === "all") return assets;

    // For now, categorize all crypto assets as "crypto"
    // In a real app, you'd have proper categorization logic
    const cryptoAssets = ["XLM", "nBTC", "nETH", "nSOL", "BTC", "ETH", "SOL"];
    const dwmAssets = ["nUSD"];
    const stockAssets = ["nTESLA"];
    const indexAssets = ["nS&P500"];

    switch (selectedCategory) {
      case "crypto":
        return assets.filter((asset) =>
          cryptoAssets.includes(asset.asset_code)
        );
      case "dwms":
        return assets.filter((asset) => dwmAssets.includes(asset.asset_code));
      case "stocks":
        return assets.filter((asset) => stockAssets.includes(asset.asset_code));
      case "indexes":
        return assets.filter((asset) => indexAssets.includes(asset.asset_code));
      default:
        return assets;
    }
  }, [assets, selectedCategory]);

  if (isLoading) {
    return (
      <YStack space='$4'>
        {/* Category tabs */}
        <XStack justifyContent='space-between' paddingHorizontal='$2'>
          {categories.map((category) => (
            <Button
              key={category.value}
              size='$2'
              backgroundColor='transparent'
              color='#1C252E'
              fontSize='$3'
              fontWeight='200'
              disabled
            >
              {category.label}
            </Button>
          ))}
        </XStack>

        <YStack space='$3' paddingHorizontal='$2'>
          <Text color='$textSecondary'>Loading assets...</Text>
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack
      space='$4'
      backgroundColor='#F9FAFB'
      borderRadius='$6'
      padding='$4'
      borderWidth={1}
      borderColor='#919EAB1F'
    >
      {/* Category tabs */}
      <XStack justifyContent='space-between' paddingHorizontal='$2'>
        {categories.map((category) => (
          <Button
            key={category.value}
            size='$2'
            backgroundColor={
              selectedCategory === category.value ? "#919EAB1F" : "transparent"
            }
            borderColor={
              selectedCategory === category.value ? "#919EAB1F" : "transparent"
            }
            color={"#1C252E"}
            fontSize='$1'
            fontWeight='400'
            borderRadius='$9'
            paddingHorizontal='$2'
            paddingVertical='$1'
            onPress={() => onCategoryChange(category.value)}
          >
            {category.label}
          </Button>
        ))}
      </XStack>

      {/* Asset list */}
      <YStack>
        {filteredAssets.map((asset, index) => (
          <AssetItem
            key={`${asset.asset_code}-${asset.asset_issuer || "native"}`}
            asset={asset}
          />
        ))}
        {filteredAssets.length === 0 && (
          <YStack alignItems='center' paddingVertical='$6'>
            <Text fontSize='$4' color='$gray11' textAlign='center'>
              No assets found in this category
            </Text>
          </YStack>
        )}
      </YStack>
    </YStack>
  );
};
