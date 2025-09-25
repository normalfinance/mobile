import React from "react";
import { YStack, XStack, H2, H6, Text, Card, ScrollView } from "tamagui";
import { mockAssets } from "@/lib/utils/mocks";

const AssetItem = ({
  name,
  symbol,
  price,
  change,
  changePercent
}: {
  name: string;
  symbol: string;
  price: string;
  change: string;
  changePercent: string;
}) => {
  const isPositive = parseFloat(change) >= 0;

  return (
    <Card elevate padding='$3' marginVertical='$2'>
      {/* @ts-ignore */}
      <XStack justifyContent='space-between' alignItems='center'>
        <YStack flex={1}>
          <H6>{name}</H6>
          <Text color='$color10' fontSize='$3'>
            {symbol}
          </Text>
        </YStack>

        {/* @ts-ignore */}
        <YStack alignItems='flex-end'>
          <Text fontSize='$4' fontWeight='600'>
            {price}
          </Text>
          <Text fontSize='$3' color={isPositive ? "$green10" : "$red10"}>
            {isPositive ? "+" : ""}
            {change} ({changePercent}%)
          </Text>
        </YStack>
      </XStack>
    </Card>
  );
};



export default function AssetsScreen() {
  return (
    // @ts-ignore
    <YStack flex={1} backgroundColor='$background'>
      {/* @ts-ignore */}
      <YStack padding='$4'>
        {/* @ts-ignore */}
        <H2 marginBottom='$2'>Assets</H2>

        {/* @ts-ignore */}
        <Text color='$color10' marginBottom='$4'>
          Track your cryptocurrency investments
        </Text>
      </YStack>

      {/* @ts-ignore */}
      <ScrollView flex={1} paddingHorizontal='$4'>
        <YStack space='$2'>
          {mockAssets.map((asset, index) => (
            <AssetItem
              key={index}
              name={asset.name}
              symbol={asset.symbol}
              price={asset.price}
              change={asset.change}
              changePercent={asset.changePercent}
            />
          ))}
        </YStack>
      </ScrollView>
    </YStack>
  );
}
