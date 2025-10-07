export type AssetCategory = "Trending" | "Crypto" | "Indexes" | "RWAs" | "Stocks" ;

export type AssetClass = "Crypto" | "Stock" | "Index" | "ETF" | "Crypto Index" | "Commodity";

export interface AssetDetail {
  label: string;
  value: string;
  emphasize?: boolean;
  numeric?: boolean;
}

export interface FeaturedAsset {
  name: string;
  symbol: string; 
  price: number;
  changePercent: number;
  class: AssetClass;
  cardColor: string;
}

export interface CollectionAsset {
  name: string;
  symbol: string;
  price: number;
  changePercent: number;
  class: AssetClass;
  categories: string[];
  details: AssetDetail[];
}

const featuredAssetsMock: FeaturedAsset[] = [
  {
    name: "Normal Ethereum",
    symbol: "nETH",
    price: 3905.77,
    changePercent: 2.05,
    class: "Crypto",
    cardColor: "#E4F8F1"
  },
  {
    name: "Normal Tesla",
    symbol: "nTSLA",
    price: 421.22,
    changePercent: 1.72,
    class: "Stock",
    cardColor: "#FFEDEC"
  },
  {
    name: "Normal OUSG",
    symbol: "nOUSG",
    price: 413.63,
    changePercent: 1.18,
    class: "Index",
    cardColor: "#F0EDFF"
  }
];

const collectionAssetsMock: CollectionAsset[] = [
  {
    name: "Normal Ethereum",
    symbol: "nETH",
    price: 3905.77,
    changePercent: 2.05,
    class: "Crypto",
    categories: ["Trending", "Crypto"],
    details: [
      { label: "Market Cap", value: "$469.28B", numeric: true },
      { label: "24h volume", value: "$18B", numeric: true }
    ]
  },
  {
    name: "Normal Tesla",
    symbol: "nTSLA",
    price: 421.22,
    changePercent: -0.39,
    class: "Stock",
    categories: ["Trending", "Stocks"],
    details: [{ label: "Market Cap", value: "$974.21B", numeric: true }]
  },
  {
    name: "Normal OUSG",
    symbol: "nOUSG",
    price: 421.22,
    changePercent: -0.39,
    class: "Index",
    categories: ["Trending", "Indexes"],
    details: [
      { label: "Region", value: "Global Tech" },
      { label: "Number of constituents", value: "500 companies" }
    ]
  },
  {
    name: "Normal S&P 500 E",
    symbol: "nSPYOn",
    price: 421.22,
    changePercent: 1.28,
    class: "Commodity",
    categories: ["Trending", "Indexes"],
    details: [{ label: "AUM", value: "$420B", numeric: true }]
  },
  {
    name: "Normal Real Estate",
    symbol: "nREIT",
    price: 128.45,
    changePercent: 0.85,
    class: "ETF",
    categories: ["RWAs", "Trending"],
    details: [
      { label: "12m yield", value: "5.20%", numeric: true },
      { label: "Min. lockup", value: "90 days" }
    ]
  },
  {
    name: "Normal Bitcoin",
    symbol: "nBTC",
    price: 60215.4,
    changePercent: -1.02,
    class: "Crypto",
    categories: ["Crypto"],
    details: [
      { label: "Market Cap", value: "$1.18T", numeric: true },
      { label: "24h volume", value: "$32B", numeric: true }
    ]
  }
];

const assetCategoriesMock: AssetCategory[] = [
  "Trending",
  "Crypto",
  "Indexes",
  "RWAs",
  "Stocks"
];

export const getFeaturedAssets = (): FeaturedAsset[] => featuredAssetsMock;

export const getCollectionAssets = (): CollectionAsset[] =>
  collectionAssetsMock;

export const getAssetCategories = (): AssetCategory[] => assetCategoriesMock;
