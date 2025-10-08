import type { AssetClass } from "@/services/prices.service";

export const assetClassStyles: Record<
  AssetClass,
  { color: string; backgroundColor: string }
> = {
  Crypto: { color: "#00C4A2", backgroundColor: "#2DE9C833" },
  Stock: { color: "#FF6F4C", backgroundColor: "#FF6F4C33" },
  Index: { color: "#947BFF", backgroundColor: "#947BFF33" },
  ETF: { color: "#F8279C", backgroundColor: "#F8279C33" },
  "Crypto Index": { color: "#00AFF7", backgroundColor: "#00AFF733" },
  Commodity: { color: "#D2B100", backgroundColor: "#FFE13D33" }
};

