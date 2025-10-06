import React, { useState } from "react";
import { FlatList } from "react-native";
import { YStack, XStack, Text, Button, Circle } from "tamagui";
import { ArrowUpRight, ArrowDownRight } from "lucide-react-native";
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
  const formattedBalance = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(parseFloat(asset.balance));
  const formattedUsdValue = asset.usdValue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const formattedUsdPrice = asset.usdPrice.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return (
    <YStack
      space='$3'
      paddingVertical='$4'
      paddingHorizontal='$3'
      borderBottomColor='#919EAB1F'
      borderBottomWidth={1}
    >
      <XStack alignItems='center' justifyContent='space-between' width='100%'>
        <XStack alignItems='center' space='$3'>
          <Circle size={44} backgroundColor={tokenIcon.bgColor}>
            <Text fontSize='$4' fontWeight='700' color='white'>
              {tokenIcon.icon}
            </Text>
          </Circle>
          <YStack>
            <Text
              fontSize='$2'
              fontWeight='700'
              color='#1C252E'
              marginBottom='$2'
            >
              {asset.display_name}
            </Text>
            <Text
              fontSize='$1'
              color='#637381'
              fontWeight='700'
              fontFamily='$numeric'
            >
              {formattedBalance} {asset.asset_code}
            </Text>
          </YStack>
        </XStack>

        <YStack alignItems='flex-end' space='$1' gap='$1'>
          <Text
            fontSize='$3'
            fontWeight='700'
            color='#1C252E'
            fontFamily='$numeric'
          >
            ${formattedUsdValue}
          </Text>
          {asset.priceChange24h !== undefined && (
            <XStack alignItems='center' space='$1'>
              {isPositive ? (
                <ArrowUpRight size={14} color='#22C55E' />
              ) : (
                <ArrowDownRight size={14} color='#EF4444' />
              )}
              <Text
                fontSize='$1'
                color='#637381'
                fontWeight='600'
                fontFamily='$numeric'
              >
                {isPositive ? "+" : ""}
                {asset.priceChange24h.toFixed(2)}%
              </Text>
            </XStack>
          )}
          <Text
            fontSize='$2'
            color='#637381'
            fontWeight='600'
            fontFamily='$numeric'
          >
            1 {asset.asset_code} = ${formattedUsdPrice}
          </Text>
        </YStack>
      </XStack>

      <XStack justifyContent='flex-end' space='$2'>
        <Button
          color='white'
          borderRadius='$10'
          fontSize='$1'
          fontWeight='800'
          backgroundColor='#1C252E'
        >
          <Text color='white'>Trade</Text>
        </Button>
        <Button
          backgroundColor='#919EAB'
          borderRadius='$10'
          fontSize='$1'
          fontWeight='800'
        >
          <Text color='#FFFFFF'>Stats</Text>
        </Button>
      </XStack>
    </YStack>
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
      <YStack space='$3'>
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
