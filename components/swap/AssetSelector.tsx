import React from "react";
import { FlatList } from "react-native";
import { XStack, YStack, Text, Button, Sheet, Circle } from "tamagui";
import { ChevronDown } from "lucide-react-native";
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
        backgroundColor='$sectionBackground'
        borderColor='$borderColor'
        borderWidth={1}
        borderRadius='$input'
        padding='$1'
        minWidth={120}
      >
        <XStack
          alignItems='center'
          space='$2'
          justifyContent='space-between'
          height='100%'
        >
          {selectedAsset ? (
            <>
              <Circle size={24} backgroundColor='$purple500' marginRight='$2'>
                <Text fontSize='$2' color='white' fontWeight='700'>
                  {("asset_code" in selectedAsset
                    ? selectedAsset.asset_code
                    : selectedAsset.symbol
                  ).charAt(0)}
                </Text>
              </Circle>
              <Text fontSize='$4' fontWeight='600' color='$textPrimary'>
                {"asset_code" in selectedAsset
                  ? selectedAsset.asset_code
                  : selectedAsset.symbol}
              </Text>
            </>
          ) : (
            <Text fontSize='$4' color='$textTertiary'>
              {availableAssets.length > 0
                ? availableAssets[0].display_name
                : placeholder}
            </Text>
          )}
          <ChevronDown size={24} color='#1C252E' />
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
        <Sheet.Frame padding='$3'>
          <YStack space='$3'>
            <Text fontSize='$6' fontWeight='600'>
              123
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
