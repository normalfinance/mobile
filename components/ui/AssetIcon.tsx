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
  /** Chain badge (bottom-right). Only USDC has one — it lives on Stellar;
   *  default on so every surface shows it (Niko 2026-10-13). */
  badge?: boolean;
}

const ChainBadge = ({ size }: { size: number }) => {
  const b = Math.max(12, Math.round(size * 0.44));
  return (
    <View
      position='absolute'
      right={-2}
      bottom={-2}
      width={b}
      height={b}
      borderRadius={b / 2}
      backgroundColor='#FFFFFF'
      alignItems='center'
      justifyContent='center'
      accessibilityLabel='on Stellar'
    >
      <Image source={cryptoIcons.XLM} style={{ width: b - 3, height: b - 3, borderRadius: (b - 3) / 2 }} contentFit='cover' />
    </View>
  );
};

// Icon resolution order (same files as the web app, different order):
//   1. bundled local file — all five v1 assets ship in the app, so the icons
//      render offline and on a tester's phone where the CDN did not answer
//   2. CDN (cdn.normalapi.com/tokens/…) for any other symbol, cached on disk
//   3. coloured circle with the ticker's initials
export const AssetIcon: React.FC<AssetIconProps> = ({
  symbol,
  size = 40,
  fontSize = "$4",
  fontWeight = "700",
  backgroundColor,
  textColor = "white",
  badge = true
}) => {
  const chainBadge = badge && symbol === "USDC";
  const iconData: AssetIconData = getAssetIconData(symbol);
  const cdnUri = getCryptoIconUrl(symbol);
  const localSource = cryptoIcons[symbol] ?? null;
  const [cdnFailed, setCdnFailed] = React.useState(false);

  // A new symbol gets a fresh attempt at the CDN.
  React.useEffect(() => {
    setCdnFailed(false);
  }, [cdnUri]);

  const source = localSource ?? (cdnUri && !cdnFailed ? { uri: cdnUri } : null);

  if (source) {
    return (
      <View position='relative' width={size} height={size}>
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
        {chainBadge ? <ChainBadge size={size} /> : null}
      </View>
    );
  }

  return (
    <View position='relative' width={size} height={size}>
      <Circle
        size={size}
        backgroundColor={backgroundColor || iconData.fallback.bgColor}
      >
        <Text fontSize={fontSize} fontWeight={fontWeight} color={textColor}>
          {iconData.fallback.textIcon}
        </Text>
      </Circle>
      {chainBadge ? <ChainBadge size={size} /> : null}
    </View>
  );
};

export default AssetIcon;
