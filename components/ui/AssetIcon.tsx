import React from "react";
import { Image } from "react-native";
import { Circle, Text, View } from "tamagui";
import {
  getAssetIconData,
  AssetIconData,
  cryptoIcons,
  isNormalToken
} from "@/lib/utils/asset-icon.utils";

export interface AssetIconProps {
  symbol: string;
  size?: number;
  fontSize?: string;
  fontWeight?: string;
  backgroundColor?: string;
  textColor?: string;
}

const getImageSource = (symbol: string) => {
  return cryptoIcons[symbol] || null;
};

const normalLogo = require("@/assets/icons/navbar/logo.webp");

export const AssetIcon: React.FC<AssetIconProps> = ({
  symbol,
  size = 40,
  fontSize = "$4",
  fontWeight = "700",
  backgroundColor,
  textColor = "white"
}) => {
  const iconData: AssetIconData = getAssetIconData(symbol);
  const imageSource = getImageSource(symbol);
  const isNormal = isNormalToken(symbol);
  const badgeSize = Math.round(size * 0.35);

  const renderNormalBadge = () => {
    if (!isNormal) return null;
    
    return (
      <Circle
        size={badgeSize}
        position="absolute"
        bottom={-2}
        right={-2}
        backgroundColor="white"
        padding={1}
        zIndex={10}
      >
        <Image
          source={normalLogo}
          style={{
            width: badgeSize - 4,
            height: badgeSize - 4,
            borderRadius: (badgeSize - 4) / 2
          }}
          resizeMode="cover"
        />
      </Circle>
    );
  };

  if (imageSource) {
    return (
      <View position="relative">
        <Circle size={size} overflow='hidden'>
          <Image
            source={imageSource}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2
            }}
            resizeMode='cover'
          />
        </Circle>
        {renderNormalBadge()}
      </View>
    );
  }

  return (
    <View position="relative">
      <Circle
        size={size}
        backgroundColor={backgroundColor || iconData.fallback.bgColor}
      >
        <Text fontSize={fontSize} fontWeight={fontWeight} color={textColor}>
          {iconData.fallback.textIcon}
        </Text>
      </Circle>
      {renderNormalBadge()}
    </View>
  );
};

export default AssetIcon;
