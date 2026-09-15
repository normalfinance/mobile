// Unified swap asset registry — verbatim web sections/swap/engines/types.ts.
// Two routing groups: stellar (XLM ⇄ USDC via Soroswap) and crosschain
// (BTC / ETH / SOL via LI.FI), joined only by the CCTP composite:
//   outbound USDC → BTC/ETH/SOL · inbound BTC/ETH/SOL → USDC (never XLM
//   directly — CCTP bridges USDC only; XLM as a source would stack a second
//   0.5% fee, so swap XLM → USDC first).

export type SwapSymbol = "XLM" | "USDC" | "BTC" | "ETH" | "SOL";
export type StellarSymbol = "XLM" | "USDC";
export type CrosschainSymbol = "BTC" | "ETH" | "SOL";
export type SwapGroup = "stellar" | "crosschain";

export interface SwapAsset {
  symbol: SwapSymbol;
  name: string;
  group: SwapGroup;
  decimals: number;
}

export const SWAP_ASSETS: SwapAsset[] = [
  { symbol: "XLM", name: "Stellar Lumens", group: "stellar", decimals: 7 },
  { symbol: "USDC", name: "USD Coin", group: "stellar", decimals: 7 },
  { symbol: "BTC", name: "Bitcoin", group: "crosschain", decimals: 8 },
  { symbol: "ETH", name: "Ethereum", group: "crosschain", decimals: 18 },
  { symbol: "SOL", name: "Solana", group: "crosschain", decimals: 9 }
];

export const assetBySymbol = (symbol: SwapSymbol): SwapAsset => SWAP_ASSETS.find((a) => a.symbol === symbol)!;
export const groupOf = (symbol: SwapSymbol): SwapGroup => assetBySymbol(symbol).group;
/** First in-group asset that isn't `symbol` — the default destination. */
export const counterpartOf = (symbol: SwapSymbol): SwapSymbol =>
  SWAP_ASSETS.find((a) => a.group === groupOf(symbol) && a.symbol !== symbol)!.symbol;

export type PairType = SwapGroup | "cctp";

export const canPair = (from: SwapSymbol, to: SwapSymbol): boolean =>
  groupOf(from) === groupOf(to) || (groupOf(from) === "crosschain" && to === "USDC") || (from === "USDC" && groupOf(to) === "crosschain");

export const pairTypeOf = (from: SwapSymbol, to: SwapSymbol): PairType => (groupOf(from) === groupOf(to) ? groupOf(from) : "cctp");

/** What mobile can run today. */
export const routeOf = (from: SwapSymbol, to: SwapSymbol): "soroswap" | "cctp-out" | "cctp-in" | "lifi" | "invalid" => {
  if (!canPair(from, to) || from === to) return "invalid";
  const type = pairTypeOf(from, to);
  if (type === "stellar") return "soroswap";
  if (type === "crosschain") return "lifi";
  return from === "USDC" ? "cctp-out" : "cctp-in";
};
