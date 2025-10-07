import React, { useMemo, useState } from "react";
import { ScrollView } from "react-native";
import { YStack, XStack, Text, Button } from "tamagui";

import { AssetIcon } from "@/components/ui/AssetIcon";
import {
  type AssetCategory,
  type AssetClass,
  type CollectionAsset,
  getAssetCategories,
  getCollectionAssets,
  getFeaturedAssets
} from "@/services/prices.service";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  ChevronRightIcon
} from "lucide-react-native";

const assetClassStyles: Record<
  AssetClass,
  { color: string; backgroundColor: string }
> = {
  Crypto: { color: "#00C4A2", backgroundColor: "#2DE9C833" },
  Stock: { color: "#FF6F4C", backgroundColor: "#FF6F4C33" },
  Index: { color: "#947BFF", backgroundColor: "#947BFF33" },
  RWA: { color: "#1C252E", backgroundColor: "#1C252E33" }
};

const featuredAssets = getFeaturedAssets();
const collectionAssets = getCollectionAssets();
const categories = getAssetCategories();

const formatPercent = (value: number) => `${Math.abs(value).toFixed(2)}%`;

const formatCurrency = (amount: number) =>
  `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const cardTextColor = "#1C252E";
const secondaryTextColor = "#637381";
const positiveChangeColor = "#00A76F";
const negativeChangeColor = "$red10";

type FilteredAssetCardProps = {
  asset: CollectionAsset;
};

const FilteredAssetCard: React.FC<FilteredAssetCardProps> = ({ asset }) => {
  const classStyle = assetClassStyles[asset.class];
  const isPositive = asset.changePercent >= 0;

  return (
    <YStack borderRadius={16} padding={16} backgroundColor='#F9FAFB' space='$3'>
      <XStack
        alignItems='flex-start'
        justifyContent='space-between'
        space='$3'
        width='100%'
      >
        <AssetIcon
          symbol={asset.symbol}
          size={42}
          backgroundColor={classStyle.color}
          fontSize='$4'
          fontWeight='700'
        />

        <YStack flex={1} space='$2'>
          <Text fontSize='$3' fontWeight='700' color={cardTextColor}>
            {asset.name}
          </Text>

          <YStack space='$1'>
            <Text
              fontSize='$2'
              color={secondaryTextColor}
              fontWeight='600'
              fontFamily='$numeric'
            >
              {asset.symbol}
            </Text>
            {asset.details.map((detail) => (
              <Text
                key={`${asset.symbol}-${detail.label}-label`}
                fontSize='$2'
                color={secondaryTextColor}
                fontWeight={detail.emphasize ? "700" : "600"}
                fontFamily='$numeric'
              >
                {detail.label}
              </Text>
            ))}
          </YStack>
        </YStack>

        <YStack alignItems='flex-end' space='$3'>
          <YStack alignItems='flex-end' space='$1'>
            <Text
              fontSize='$3'
              fontWeight='700'
              color={cardTextColor}
              fontFamily='$numeric'
            >
              {formatCurrency(asset.price)}
            </Text>
            <XStack alignItems='center' space='$1'>
              {isPositive ? (
                <ArrowUpRightIcon size={14} color={positiveChangeColor} />
              ) : (
                <ArrowDownRightIcon size={14} color={negativeChangeColor} />
              )}
              <Text
                fontSize='$2'
                fontWeight='600'
                color={isPositive ? positiveChangeColor : negativeChangeColor}
                fontFamily='$numeric'
              >
                {isPositive ? "+" : "-"}
                {formatPercent(asset.changePercent)}
              </Text>
            </XStack>
          </YStack>

          {asset.details.length > 0 && (
            <YStack alignItems='flex-end' space='$1'>
              {asset.details.map((detail) => (
                <Text
                  key={`${asset.symbol}-${detail.label}-value`}
                  fontSize='$2'
                  color={detail.emphasize ? cardTextColor : secondaryTextColor}
                  fontWeight={detail.emphasize ? "700" : "600"}
                  fontFamily='$numeric'
                >
                  {detail.value}
                </Text>
              ))}
            </YStack>
          )}

          <Text
            fontSize='$2'
            fontWeight='700'
            color={classStyle.color}
            backgroundColor={classStyle.backgroundColor}
            paddingVertical={4}
            paddingHorizontal={10}
            borderRadius={10}
            textTransform='capitalize'
            fontFamily='$numeric'
          >
            {asset.class}
          </Text>
        </YStack>
      </XStack>
    </YStack>
  );
};

export default function PricesScreen() {
  const [selectedCategory, setSelectedCategory] =
    useState<AssetCategory>("Trending");

  const filteredAssets = useMemo(() => {
    return collectionAssets.filter((asset) =>
      asset.categories.includes(selectedCategory)
    );
  }, [selectedCategory]);

  return (
    <YStack flex={1} backgroundColor='#FFFFFF'>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 24,
          paddingBottom: 40
        }}
        showsVerticalScrollIndicator={false}
      >
        <YStack space='$4'>
          <YStack space='$2'>
            <XStack justifyContent='space-between' alignItems='center'>
              <Text fontSize='$4' fontWeight='500' color={"#1C252E"}>
                Featured
              </Text>
              <XStack alignItems='center' space='$0'>
                <Text
                  fontSize='$2'
                  fontWeight='400'
                  color={"#1C252E"}
                  // textDecorationLine='underline'
                  // @ts-ignore
                  style={{
                    textDecorationLine: "underline",
                    textDecorationThickness: 0.5
                  }}
                >
                  See more
                </Text>
                <ChevronRightIcon
                  color={secondaryTextColor}
                  size={14}
                  marginTop={2}
                />
              </XStack>
            </XStack>
          </YStack>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 16, paddingRight: 24 }}
          >
            {featuredAssets.map((asset) => {
              const classStyle = assetClassStyles[asset.class];
              const isPositive = asset.changePercent >= 0;

              return (
                <YStack
                  key={asset.symbol}
                  width={200}
                  padding='$4'
                  borderRadius={20}
                  backgroundColor={"#F9FAFB"}
                  space='$3'
                >
                  <XStack alignItems='center' justifyContent='space-between'>
                    <AssetIcon
                      symbol={asset.symbol}
                      size={36}
                      fontSize='$4'
                      fontWeight='700'
                      backgroundColor={classStyle.color}
                    />
                    <Text
                      fontSize='$1'
                      fontWeight='700'
                      color={classStyle.color}
                      backgroundColor={classStyle.backgroundColor}
                      paddingVertical={4}
                      paddingHorizontal={10}
                      borderRadius={10}
                    >
                      {asset.class}
                    </Text>
                  </XStack>

                  <YStack space='$1'>
                    <Text fontSize='$3' fontWeight='700' color={cardTextColor}>
                      {asset.name}
                    </Text>
                  </YStack>

                  <YStack
                    space='$1'
                    alignItems='flex-end'
                    flexDirection='column-reverse'
                  >
                    <Text
                      fontSize='$3'
                      fontWeight='700'
                      color={cardTextColor}
                      fontFamily='$numeric'
                    >
                      {formatCurrency(asset.price)}
                    </Text>
                    <Text
                      fontSize='$2'
                      fontWeight='500'
                      color={"#637381"}
                      fontFamily='$numeric'
                    >
                      {isPositive ? "+" : "-"}
                      {formatPercent(asset.changePercent)}
                    </Text>
                  </YStack>
                </YStack>
              );
            })}
          </ScrollView>
        </YStack>

        <YStack marginTop={32} space='$4'>
          <YStack space='$2'>
            <XStack justifyContent='space-between' alignItems='center'>
              <Text fontSize='$4' fontWeight='500' color={"#1C252E"}>
                Collection
              </Text>
            </XStack>
          </YStack>

          <YStack
            backgroundColor='#F9FAFB'
            borderRadius={24}
            borderWidth={1}
            borderColor={"#919EAB1F"}
            paddingHorizontal={8}
            paddingVertical={18}
            space='$4'
          >
            <YStack
              backgroundColor='transparent'
              justifyContent='space-between'
              paddingHorizontal='$2'
            >
              <XStack space='$1' justifyContent='space-between'>
                {categories.map((category) => {
                  const isActive = selectedCategory === category;
                  return (
                    <Button
                      key={category}
                      size='$2'
                      backgroundColor={isActive ? "#919EAB1F" : "transparent"}
                      borderColor={isActive ? "#919EAB1F" : "transparent"}
                      color={"#1C252E"}
                      fontSize='$1'
                      fontWeight='400'
                      borderRadius='$9'
                      paddingHorizontal='$2'
                      paddingVertical='$1'
                      onPress={() => setSelectedCategory(category)}
                    >
                      {category}
                    </Button>
                  );
                })}
              </XStack>
            </YStack>

            <YStack space='$3'>
              {filteredAssets.map((asset) => (
                <FilteredAssetCard
                  key={`${asset.symbol}-${selectedCategory}`}
                  asset={asset}
                />
              ))}
            </YStack>
          </YStack>
        </YStack>
      </ScrollView>
    </YStack>
  );
}
