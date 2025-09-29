import React from 'react';
import { XStack, YStack, Text, Input, Button } from 'tamagui';
import { DisplayAsset } from '@/lib/types/balance.types';
import { TokenInfo } from '@/lib/types/swap.types';
import { AssetSelector } from './AssetSelector';

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
  return (
    <YStack 
      backgroundColor="$gray2" 
      borderRadius="$6" 
      padding="$4" 
      space="$3"
    >
      {/* Header with label and balance */}
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize="$3" color="$gray11" fontWeight="500">
          {label}
        </Text>
        {balance && asset && (
          <XStack alignItems="center" space="$2">
            <Text fontSize="$2" color="$gray10">
              {parseFloat(balance).toFixed(4)} {'asset_code' in asset ? asset.asset_code : asset.symbol}
            </Text>
            {showMaxButton && (
              <Button 
                size="$2" 
                backgroundColor="$blue7"
                color="white"
                onPress={onMaxPress}
                borderRadius="$2"
                paddingHorizontal="$2"
                paddingVertical="$1"
              >
                <Text fontSize="$1" color="white" fontWeight="600">Max</Text>
              </Button>
            )}
          </XStack>
        )}
      </XStack>

      {/* Amount input and asset selector */}
      <XStack space="$3" alignItems="center">
        <YStack flex={1}>
          <Input
            value={amount}
            onChangeText={onAmountChange}
            placeholder="0"
            fontSize="$8"
            fontWeight="600"
            backgroundColor="transparent"
            borderWidth={0}
            focusStyle={{ borderWidth: 0 }}
            keyboardType="numeric"
            editable={!readOnly}
          />
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