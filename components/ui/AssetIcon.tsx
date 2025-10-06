import React from "react";
import { Image } from "react-native";
import { Circle, Text } from "tamagui";
import {
  getAssetIconData,
  AssetIconData,
  cryptoIcons
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

  if (imageSource) {
    return (
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
    );
  }

  return (
    <Circle
      size={size}
      backgroundColor={backgroundColor || iconData.fallback.bgColor}
    >
      <Text fontSize={fontSize} fontWeight={fontWeight} color={textColor}>
        {iconData.fallback.textIcon}
      </Text>
    </Circle>
  );
};

export default AssetIcon;
