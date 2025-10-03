import React from "react";
import { XStack, YStack, Text, Input, Button } from "tamagui";
import { DisplayAsset } from "@/lib/types/balance.types";
import { TokenInfo } from "@/lib/types/swap.types";
import { AssetSelector } from "./AssetSelector";

interface SwapSectionProps {
  label: string;
  asset: DisplayAsset | TokenInfo | null;
  amount: string;
  onAmountChange: (amount: string) => void;
  availableAssets: (DisplayAsset | TokenInfo)[];
  onAssetSelect: (asset: DisplayAsset | TokenInfo) => void;
  placeholder: string;
  showMaxButton?: boolean;
  onMaxPress?: () => void;
  balance?: string;
  readOnly?: boolean;
}

export const SwapSection: React.FC<SwapSectionProps> = ({
  label,
  asset,
  amount,
  onAmountChange,
  availableAssets,
  onAssetSelect,
  placeholder,
  showMaxButton = false,
  onMaxPress,
  balance,
  readOnly = false
}) => {
  // Calculate USD value (placeholder calculation)
  const usdValue = amount ? (parseFloat(amount) * 1000).toFixed(2) : "0.00";

  return (
    <YStack
      backgroundColor={
        label === "Buy" ? "#ffffff" : "#919eab14"
      }
      borderRadius='$card'
      padding='$cardPadding'
      space='$3'
      borderWidth={1}
      borderColor='$borderColor'
    >
      {/* Header with label and balance */}
      <XStack justifyContent='space-between' alignItems='center'>
        <Text fontSize='$3' color='$textSecondary' fontWeight='500'>
          {label}
        </Text>
        {balance && asset && (
          <XStack alignItems='center' space='$2'>
            <Text fontSize='$2' color='$textSecondary'>
              {parseFloat(balance).toFixed(4)}{" "}
              {"asset_code" in asset ? asset.asset_code : asset.symbol}
            </Text>
            {showMaxButton && (
              <Button
                size='$2'
                backgroundColor='$purple500'
                color='white'
                onPress={onMaxPress}
                borderRadius='$2'
                paddingHorizontal='$2'
                paddingVertical='$1'
              >
                <Text fontSize='$1' color='white' fontWeight='600'>
                  Max
                </Text>
              </Button>
            )}
          </XStack>
        )}
      </XStack>

      {/* Amount input and asset selector */}
      <XStack justifyContent='space-between' alignItems='center'>
        <YStack flex={1} space='$1' alignItems='start'>
          <Input
            value={amount}
            onChangeText={onAmountChange}
            placeholder='0'
            fontSize='$9'
            fontWeight='700'
            backgroundColor='transparent'
            borderWidth={0}
            focusStyle={{ borderWidth: 0 }}
            keyboardType='numeric'
            editable={!readOnly}
            color='$textPrimary'
            placeholderTextColor='$textTertiary'
            textAlign='left'
            textAlignVertical='top'
            paddingVertical='$1'
            paddingHorizontal='$0'
            marginLeft='$0'
            marginRight='$0'
          />
          <Text fontSize='$3' color='$textSecondary'>
            ${usdValue}
          </Text>
        </YStack>

        <AssetSelector
          selectedAsset={asset}
          availableAssets={availableAssets}
          onAssetSelect={onAssetSelect}
          placeholder={placeholder}
          showBalance={false}
        />
      </XStack>
    </YStack>
  );
};
