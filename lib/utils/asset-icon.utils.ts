// Token icons. Resolution lives in components/ui/AssetIcon.tsx: CDN first,
// then a bundled file, then a coloured circle with the ticker. Only the two
// Stellar assets ship a bundled fallback — the ~100 synthetic "nXXX" icons of
// the discontinued synthetics product (256 MB of PNG/WebP, bundled into every
// build) were removed 2026-10-05; the EAS upload had excluded that folder,
// which broke release bundles with "Unable to resolve USDC.webp".

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
