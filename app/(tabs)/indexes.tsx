import React, { useMemo, useState } from "react";
import { ScrollView } from "react-native";
import { useAssets } from "expo-asset";
import { SvgUri } from "react-native-svg";
import { YStack, XStack, Text, Button, Card } from "tamagui";
import { useRouter } from "expo-router";

import { AssetIcon } from "@/components/ui/AssetIcon";
import {
  type IndexCategory,
  type CollectionIndex,
  getIndexCategories,
  getCollectionIndexes,
  getFeaturedIndexes
} from "@/services/indexes.service";
import { ChevronRightIcon } from "lucide-react-native";

import { assetClassStyles } from "@/constants/assetClassStyles";

const featuredIndexes = getFeaturedIndexes();
const collectionIndexes = getCollectionIndexes();
const categories = getIndexCategories();

const formatPercent = (value: number) => `${Math.abs(value).toFixed(2)}%`;

const formatCurrency = (amount: number) =>
  `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const cardTextColor = "#1C252E";
const secondaryTextColor = "#637381";

type FilteredIndexCardProps = {
  indexAsset: CollectionIndex;
  increaseIconUri?: string;
  decreaseIconUri?: string;
  onPress?: () => void;
};

const tokenTagStyle = {
  backgroundColor: "#919EAB14",
  color: secondaryTextColor,
  fontSize: "$1",
  fontWeight: "600" as const,
  borderRadius: 8,
  paddingHorizontal: 8,
  paddingVertical: 4
};

const FilteredIndexCard: React.FC<FilteredIndexCardProps> = ({
  indexAsset,
  increaseIconUri,
  decreaseIconUri,
  onPress
}) => {
  const classStyle = assetClassStyles[indexAsset.class];
  const isPositive = indexAsset.changePercent >= 0;
  const changeIconUri = isPositive ? increaseIconUri : decreaseIconUri;
  const changeTextPrefix =
    indexAsset.changePercent === 0 ? "" : isPositive ? "+" : "-";

  const detailRows = indexAsset.details.map((detail) => ({
    key: `${indexAsset.symbol}-${detail.label}`,
    left: (
      <Text
        fontSize='$2'
        color={secondaryTextColor}
        fontWeight={detail.emphasize ? "700" : "600"}
        fontFamily='$numeric'
      >
        {detail.label}
      </Text>
    ),
    right: (
      <Text
        fontSize='$2'
        color={detail.emphasize ? cardTextColor : secondaryTextColor}
        fontWeight={detail.emphasize ? "700" : "600"}
        fontFamily='$numeric'
      >
        {detail.value}
      </Text>
    )
  }));

  const rows = [
    {
      key: `${indexAsset.symbol}-name`,
      left: (
        <Text fontSize='$3' fontWeight='700' color={cardTextColor}>
          {indexAsset.name}
        </Text>
      ),
      right: (
        <Text
          fontSize='$3'
          fontWeight='700'
          color={cardTextColor}
          fontFamily='$numeric'
        >
          {formatCurrency(indexAsset.price)}
        </Text>
      )
    },
    {
      key: `${indexAsset.symbol}-change`,
      left: (
        <Text
          fontSize='$2'
          color={secondaryTextColor}
          fontWeight='600'
          fontFamily='$numeric'
        >
          {indexAsset.symbol}
        </Text>
      ),
      right: (
        <XStack alignItems='center' space='$1'>
          {changeIconUri != null ? (
            <SvgUri width={16} height={16} uri={changeIconUri} />
          ) : null}
          <Text
            fontSize='$2'
            color={secondaryTextColor}
            fontWeight='600'
            fontFamily='$numeric'
          >
            {`${changeTextPrefix}${formatPercent(indexAsset.changePercent)}`}
          </Text>
        </XStack>
      )
    },
    ...detailRows,
    {
      key: `${indexAsset.symbol}-class`,
      left: (
        <XStack flexWrap='wrap' gap={8} alignItems='flex-start'>
          {indexAsset.tokens.map((token) => (
            <Text
              key={`${indexAsset.symbol}-${token}`}
              {...tokenTagStyle}
              minWidth={50}
            >
              {token}
            </Text>
          ))}
        </XStack>
      )
      //   right: (
      //     <Text
      //       fontSize='$1'
      //       fontWeight='700'
      //       color={classStyle.color}
      //       backgroundColor={classStyle.backgroundColor}
      //       paddingVertical={4}
      //       paddingHorizontal={8}
      //       borderRadius={6}
      //       fontFamily='$numeric'
      //     >
      //       {indexAsset.class}
      //     </Text>
      //   )
    }
  ];

  return (
    <Card
      borderRadius={16}
      padding={8}
      backgroundColor='#F9FAFB'
      onPress={onPress}
      pressable={onPress != null}
      borderBottomWidth={1}
      borderBottomColor='#919EAB1F'
    >
      <XStack alignItems='flex-start' space='$3' width='100%'>
        <AssetIcon
          symbol={indexAsset.symbol}
          size={36}
          backgroundColor={classStyle.color}
          fontSize='$4'
          fontWeight='700'
        />

        <YStack flex={1} space='$2'>
          {rows.map((row) => (
            <XStack
              key={row.key}
              alignItems='center'
              justifyContent='space-between'
              gap='$3'
              marginRight={8}
            >
              <YStack width='70%'>{row.left}</YStack>
              <YStack width='30%' alignItems='flex-end'>
                {row.right}
              </YStack>
            </XStack>
          ))}
        </YStack>
      </XStack>

      {indexAsset.editable ? (
        <XStack justifyContent='flex-end' marginTop={8}>
          <Button
            size='$2'
            backgroundColor='#1C252E'
            color='#FFFFFF'
            borderRadius={12}
            paddingHorizontal={12}
          >
            <Text fontSize='$3' fontWeight='700' color='#FFFFFF'>
              Edit
            </Text>
          </Button>
        </XStack>
      ) : null}
    </Card>
  );
};

const IndexesScreen: React.FC = () => {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] =
    useState<IndexCategory>("Holding");
  const [changeIcons] = useAssets([
    require("@svgs/increase.svg"),
    require("@svgs/decrease.svg")
  ]);

  const increaseIcon = changeIcons?.[0];
  const decreaseIcon = changeIcons?.[1];

  const increaseIconUri =
    increaseIcon != null
      ? increaseIcon.localUri ?? increaseIcon.uri
      : undefined;
  const decreaseIconUri =
    decreaseIcon != null
      ? decreaseIcon.localUri ?? decreaseIcon.uri
      : undefined;

  const filteredIndexes = useMemo(() => {
    return collectionIndexes.filter((asset) =>
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
            {featuredIndexes.map((asset) => {
              const classStyle = assetClassStyles[asset.class];
              const isPositive = asset.changePercent >= 0;
              const changeIconUri = isPositive
                ? increaseIconUri
                : decreaseIconUri;
              const changeTextPrefix =
                asset.changePercent === 0 ? "" : isPositive ? "+" : "-";

              return (
                <Card
                  key={asset.symbol}
                  width={200}
                  padding='$4'
                  borderRadius={20}
                  backgroundColor={"#F9FAFB"}
                  borderWidth={1}
                  borderColor={"#919EAB1F"}
                  space='$3'
                  onPress={() =>
                    router.push(`/asset/${asset.symbol.toLowerCase()}`)
                  }
                  pressable
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
                      fontWeight='600'
                      color={cardTextColor}
                      fontFamily='$numeric'
                    >
                      {formatCurrency(asset.price)}
                    </Text>
                    <XStack alignItems='center' space='$1'>
                      {changeIconUri != null ? (
                        <SvgUri width={16} height={16} uri={changeIconUri} />
                      ) : null}
                      <Text
                        fontSize='$2'
                        fontWeight='500'
                        color={secondaryTextColor}
                        fontFamily='$numeric'
                      >
                        {`${changeTextPrefix}${formatPercent(
                          asset.changePercent
                        )}`}
                      </Text>
                    </XStack>
                  </YStack>
                </Card>
              );
            })}
          </ScrollView>
        </YStack>

        <Button
          height={48}
          backgroundColor='#1C252E'
          color='#FFFFFF'
          borderRadius={12}
          fontSize='$3'
          fontWeight='600'
          onPress={() => router.push("/indexes/create")}
          marginVertical={32}
        >
          <Text fontSize='$3' fontWeight='700' color='#FFFFFF'>
            Create Index
          </Text>
        </Button>

        <YStack marginTop={0} space='$4'>
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
              {filteredIndexes.map((asset) => (
                <FilteredIndexCard
                  key={`${asset.symbol}-${selectedCategory}`}
                  indexAsset={asset}
                  increaseIconUri={increaseIconUri}
                  decreaseIconUri={decreaseIconUri}
                  onPress={() =>
                    router.push(`/asset/${asset.symbol.toLowerCase()}`)
                  }
                />
              ))}
            </YStack>
          </YStack>
        </YStack>
      </ScrollView>
    </YStack>
  );
};

export default IndexesScreen;
