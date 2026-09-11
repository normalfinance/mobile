import React from "react";
import { Image } from "expo-image";
import { Circle, Text, View } from "tamagui";

import {
  getAssetIconData,
  AssetIconData,
  cryptoIcons
} from "@/lib/utils/asset-icon.utils";
import { getCryptoIconUrl } from "@/lib/utils/cdn.utils";

export interface AssetIconProps {
  symbol: string;
  size?: number;
  fontSize?: string;
  fontWeight?: string;
  backgroundColor?: string;
  textColor?: string;
}

// Icon resolution order — identical output to the web app:
//   1. CDN (cdn.normalapi.com/tokens/…), cached on disk by expo-image
//   2. bundled local file, if we happen to ship one (XLM, USDC)
//   3. coloured circle with the ticker's initials
export const AssetIcon: React.FC<AssetIconProps> = ({
  symbol,
  size = 40,
  fontSize = "$4",
  fontWeight = "700",
  backgroundColor,
  textColor = "white"
}) => {
  const iconData: AssetIconData = getAssetIconData(symbol);
  const cdnUri = getCryptoIconUrl(symbol);
  const localSource = cryptoIcons[symbol] ?? null;
  const [cdnFailed, setCdnFailed] = React.useState(false);

  // A new symbol gets a fresh attempt at the CDN.
  React.useEffect(() => {
    setCdnFailed(false);
  }, [cdnUri]);

  const source =
    cdnUri && !cdnFailed ? { uri: cdnUri } : localSource ?? null;

  if (source) {
    return (
      <View position='relative'>
        <Circle size={size} overflow='hidden' backgroundColor='$gray3'>
          <Image
            source={source}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            contentFit='cover'
            cachePolicy='memory-disk'
            transition={120}
            recyclingKey={symbol}
            onError={() => setCdnFailed(true)}
            accessibilityLabel={`${symbol} icon`}
          />
        </Circle>
      </View>
    );
  }

  return (
    <View position='relative'>
      <Circle
        size={size}
        backgroundColor={backgroundColor || iconData.fallback.bgColor}
      >
        <Text fontSize={fontSize} fontWeight={fontWeight} color={textColor}>
          {iconData.fallback.textIcon}
        </Text>
      </Circle>
    </View>
  );
};

export default AssetIcon;
