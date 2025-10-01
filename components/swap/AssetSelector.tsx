import React from "react";
import { FlatList } from "react-native";
import { XStack, YStack, Text, Button, Sheet } from "tamagui";
import { DisplayAsset } from "@/lib/types/balance.types";
import { TokenInfo } from "@/lib/types/swap.types";

interface AssetSelectorProps {
  selectedAsset: DisplayAsset | TokenInfo | null;
  availableAssets: (DisplayAsset | TokenInfo)[];
  onAssetSelect: (asset: DisplayAsset | TokenInfo) => void;
  placeholder: string;
  showBalance?: boolean;
}

export const AssetSelector: React.FC<AssetSelectorProps> = ({
  selectedAsset,
  availableAssets,
  onAssetSelect,
  placeholder,
  showBalance = false
}) => {
  const [open, setOpen] = React.useState(false);

  const renderAssetItem = ({ item }: { item: DisplayAsset | TokenInfo }) => {
    // Handle both DisplayAsset and TokenInfo types
    const symbol = "asset_code" in item ? item.asset_code : item.symbol;
    const name = "display_name" in item ? item.display_name : item.name;
    const balance = "balance" in item ? item.balance : undefined;

    return (
      <Button
        key={`${
          "asset_code" in item ? item.asset_code : item.symbol
        }-${Math.random()}`}
        onPress={() => {
          onAssetSelect(item);
          setOpen(false);
        }}
        backgroundColor='$background'
        borderColor='$borderColor'
        borderWidth={1}
        marginVertical='$1'
        padding='$3'
      >
        <XStack alignItems='center' justifyContent='space-between' width='100%'>
          <YStack alignItems='flex-start'>
            <Text fontSize='$4' fontWeight='600'>
              {symbol}
            </Text>
            <Text fontSize='$2' color='$gray10'>
              {name}
            </Text>
          </YStack>
          {balance && showBalance && (
            <Text fontSize='$3' color='$gray11'>
              {parseFloat(balance).toFixed(4)}
            </Text>
          )}
        </XStack>
      </Button>
    );
  };

  return (
    <>
      <Button
        onPress={() => setOpen(true)}
        backgroundColor='$background'
        borderColor='$borderColor'
        borderWidth={1}
        borderRadius='$4'
        padding='$3'
      >
        <XStack alignItems='center' space='$2'>
          {selectedAsset ? (
            <Text fontSize='$4' fontWeight='600'>
              {"asset_code" in selectedAsset
                ? selectedAsset.asset_code
                : selectedAsset.symbol}
            </Text>
          ) : (
            <Text fontSize='$4' color='$gray10'>
              {placeholder}
            </Text>
          )}
          ChevronDown
        </XStack>
      </Button>

      <Sheet
        modal
        open={open}
        onOpenChange={setOpen}
        snapPoints={[80]}
        dismissOnSnapToBottom
      >
        <Sheet.Overlay />
        <Sheet.Handle />
        <Sheet.Frame padding='$4'>
          <YStack space='$4'>
            <Text fontSize='$6' fontWeight='600'>
              Select Token
            </Text>
            <FlatList
              data={availableAssets}
              renderItem={renderAssetItem}
              keyExtractor={(item) =>
                "asset_code" in item ? item.asset_code : item.symbol
              }
              showsVerticalScrollIndicator={false}
            />
          </YStack>
        </Sheet.Frame>
      </Sheet>
    </>
  );
};
