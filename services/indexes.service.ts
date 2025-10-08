import type { AssetClass, AssetDetail } from "./prices.service";

export type IndexCategory =
  | "Holding"
  | "My indexes"
  | "Trending"
  | "All indexes";

export interface FeaturedIndex {
  name: string;
  symbol: string;
  price: number;
  changePercent: number;
  class: AssetClass;
  cardColor: string;
}

export interface CollectionIndex {
  name: string;
  symbol: string;
  price: number;
  changePercent: number;
  class: AssetClass;
  categories: IndexCategory[];
  details: AssetDetail[];
  tokens: string[];
  editable?: boolean;
}

const featuredIndexesMock: FeaturedIndex[] = [
  {
    name: "Normal Top 10 Index",
    symbol: "NTOP10",
    price: 433.1,
    changePercent: 2.05,
    class: "Crypto Index",
    cardColor: "#F9FAFB"
  },
  {
    name: "Normal DeFi Index",
    symbol: "NDFI",
    price: 421.22,
    changePercent: 1.72,
    class: "Crypto Index",
    cardColor: "#F9FAFB"
  },
  {
    name: "Normal Layer-1 Index",
    symbol: "NL1X",
    price: 413.68,
    changePercent: 1.19,
    class: "Crypto Index",
    cardColor: "#F9FAFB"
  }
];

const collectionIndexesMock: CollectionIndex[] = [
  {
    name: "Normal Top 10 Index",
    symbol: "NTOP10",
    price: 433.1,
    changePercent: 1.28,
    class: "Crypto Index",
    categories: ["Holding", "My indexes", "Trending", "All indexes"],
    details: [
      { label: "TVL", value: "$29.24B", emphasize: true, numeric: true },
      { label: "Number of assets", value: "10 tokens" }
    ],
    tokens: [
      "BTC",
      "ETH",
      "SOL",
      "ADA",
      "XRP",
      "DOT",
      "AVAX",
      "LINK",
      "DOGE",
      "LTC"
    ],
    editable: true
  },
  {
    name: "Normal DeFi Index",
    symbol: "NDFI",
    price: 42.66,
    changePercent: 1.48,
    class: "Crypto Index",
    categories: ["Holding", "My indexes", "Trending", "All indexes"],
    details: [
      { label: "TVL", value: "$87M", emphasize: true, numeric: true },
      { label: "Number of assets", value: "7 tokens" }
    ],
    tokens: ["ETH", "SOL", "ADA", "XRP", "DOT", "AVAX", "LINK"]
  },
  {
    name: "Normal Layer-1 Index",
    symbol: "NL1X",
    price: 85.73,
    changePercent: 3.8,
    class: "Crypto Index",
    categories: ["Holding", "Trending", "All indexes"],
    details: [
      { label: "TVL", value: "$95M", emphasize: true, numeric: true },
      { label: "Number of assets", value: "12 tokens" }
    ],
    tokens: [
      "BTC",
      "ETH",
      "SOL",
      "ADA",
      "XRP",
      "DOT",
      "AVAX",
      "LINK",
      "MATIC",
      "ATOM",
      "LTC",
      "XLM"
    ]
  }
];

const indexCategoriesMock: IndexCategory[] = [
  "Holding",
  "My indexes",
  "Trending",
  "All indexes"
];

export const getFeaturedIndexes = (): FeaturedIndex[] => featuredIndexesMock;

export const getCollectionIndexes = (): CollectionIndex[] =>
  collectionIndexesMock;

export const getIndexCategories = (): IndexCategory[] => indexCategoriesMock;

