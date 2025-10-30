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

// Mainnet token definitions (XLM and USDC only for now)
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
  }
];

// Network-aware token export
const getAvailableTokens = (): TokenInfo[] => {
  const network = process.env.EXPO_PUBLIC_NETWORK || "TESTNET";
  return network === "MAINNET" ? MAINNET_TOKENS : TESTNET_TOKENS;
};

export const AVAILABLE_SWAP_TOKENS: TokenInfo[] = getAvailableTokens();
