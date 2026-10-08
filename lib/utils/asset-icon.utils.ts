// Token icons. Resolution lives in components/ui/AssetIcon.tsx: a bundled
// file first (the five v1 assets ship in the app — the same WebP files the
// CDN serves, ~400 KB total — so icons never depend on the network: a
// tester's Home showed initials for BTC/ETH/SOL on 2026-10-08 when the CDN
// did not answer), then the CDN for any other symbol, then a coloured circle
// with the ticker. The ~100 synthetic "nXXX" icons of the discontinued
// synthetics product were removed 2026-10-05.

export interface AssetIconConfig {
  bgColor: string;
  textIcon: string;
}

export interface AssetIconData {
  symbol: string;
  hasImage: boolean;
  fallback: AssetIconConfig;
}

export const cryptoIcons: Record<string, number> = {
  BTC: require("@/assets/icons/crypto-icons/BTC.webp"),
  ETH: require("@/assets/icons/crypto-icons/ETH.webp"),
  SOL: require("@/assets/icons/crypto-icons/SOL.webp"),
  USDC: require("@/assets/icons/crypto-icons/USDC.webp"),
  XLM: require("@/assets/icons/crypto-icons/XLM.webp")
};

const FALLBACK: Record<string, AssetIconConfig> = {
  XLM: { bgColor: "$black", textIcon: "✦" },
  BTC: { bgColor: "#f7931a", textIcon: "₿" },
  ETH: { bgColor: "#627eea", textIcon: "Ξ" },
  SOL: { bgColor: "#9945ff", textIcon: "S" },
  USDC: { bgColor: "$blue9", textIcon: "$" },
  USDT: { bgColor: "$green9", textIcon: "$" }
};

export const getAssetIconData = (symbol: string): AssetIconData => ({
  symbol,
  hasImage: symbol in cryptoIcons,
  fallback: FALLBACK[symbol] ?? { bgColor: "$purple500", textIcon: symbol.charAt(0).toUpperCase() }
});
