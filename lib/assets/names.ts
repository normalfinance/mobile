// One display name per asset for every list, picker and header. USDC says
// where it lives: Normal holds USDC on Stellar only, and a user who sends
// Ethereum / Solana / Base USDC to a Stellar address loses it (Niko
// 2026-10-13: "usdc must clearly indicate it is on the stellar chain on all
// screens that render it"). AssetIcon adds the Stellar badge to the USDC icon
// so even symbol-only surfaces carry the chain.

export const ASSET_BASE_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  XLM: "Stellar Lumens",
  USDC: "USD Coin"
};

export const ASSET_CHAIN_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  XLM: "Stellar",
  USDC: "Stellar"
};

/** "USD Coin · Stellar" for USDC; the plain name for assets that ARE their chain. */
export const assetDisplayName = (symbol: string): string => {
  const base = ASSET_BASE_NAMES[symbol] ?? symbol;
  return symbol === "USDC" ? `${base} · ${ASSET_CHAIN_NAMES.USDC}` : base;
};

/** "USD Coin on the Stellar network" — the long form for headers and warnings. */
export const assetNetworkLine = (symbol: string): string =>
  `${ASSET_BASE_NAMES[symbol] ?? symbol} on the ${ASSET_CHAIN_NAMES[symbol] ?? symbol} network`;
