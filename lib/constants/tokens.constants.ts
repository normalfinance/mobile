import { TokenInfo } from "../types/swap.types";

// Testnet token definitions (keep all existing tokens)
const TESTNET_TOKENS: TokenInfo[] = [
  {
    address: "GB55TEPZCAPVA5QKOGTKEBLGJNCP4LSEIM65PMKYKVTABMFCKQNKPJ2H",
    symbol: "nBTC",
    name: "nBTC",
    decimals: 8
  },
  {
    address: "GB55TEPZCAPVA5QKOGTKEBLGJNCP4LSEIM65PMKYKVTABMFCKQNKPJ2H",
    symbol: "nETH",
    name: "nETH",
    decimals: 18
  },
  {
    address: "GB55TEPZCAPVA5QKOGTKEBLGJNCP4LSEIM65PMKYKVTABMFCKQNKPJ2H",
    symbol: "nSOL",
    name: "nSOL",
    decimals: 9
  },
  {
    address: "native",
    symbol: "XLM",
    name: "Stellar Lumens",
    decimals: 7
  }
];

// Mainnet token definitions
const MAINNET_TOKENS: TokenInfo[] = [
  {
    address: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
    symbol: "XLM",
    name: "Stellar Lumens",
    decimals: 7
  },
  {
    address: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 7
  },
  {
    address: "CCUE2TFP3NDNECT4WY73QWEUNPHNGI6P77B6BVCL6EEZD26YMHY4WEGW",
    symbol: "nBTC",
    name: "Normal Bitcoin",
    decimals: 7,
    logoUrl: "https://cdn.normalapi.com/tokens/normal/nBTC.webp"
  },
  {
    address: "CDDY3K5QNZUKO254MADCUMUPEVIK64I2VW4VLZNHND6W467UMBUP2YII",
    symbol: "nETH",
    name: "Normal Ethereum",
    decimals: 7,
    logoUrl: "https://cdn.normalapi.com/tokens/normal/nETH.webp"
  },
  {
    address: "CC3HDXOCIMP2NMLNHPYYFMEKLJRYSSSX57BLCBQ4XTIDXAO6GZWP36XB",
    symbol: "nSOL",
    name: "Normal Solana",
    decimals: 7,
    logoUrl: "https://cdn.normalapi.com/tokens/normal/nSOL.webp"
  }
];

// Network-aware token export
const getAvailableTokens = (): TokenInfo[] => {
  const network = process.env.EXPO_PUBLIC_NETWORK || "TESTNET";
  return network === "MAINNET" ? MAINNET_TOKENS : TESTNET_TOKENS;
};

export const AVAILABLE_SWAP_TOKENS: TokenInfo[] = getAvailableTokens();
