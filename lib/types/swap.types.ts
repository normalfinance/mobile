import { DisplayAsset } from './balance.types';

export interface DexDistribution {
  parts: string;
  path: string;
  protocol_id: string;
}

export interface SwapParams {
  amount_in: string;
  amount_out_min: string;
  deadline: number;
  distribution: Array<DexDistribution>;
  to: string;
  token_in: string;
  token_out: string;
}

export interface SwapQuoteRequest {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippageTolerance?: number; // Default 0.5%
}

export interface SwapQuote {
  amountIn: string;
  amountOut: string;
  amountOutMin: string;
  priceImpact: string;
  route: DexDistribution[];
  deadline: number;
  swapParams: SwapParams;
}

export interface SwapFormData {
  sellAsset: DisplayAsset | null;
  buyAsset: DisplayAsset | null;
  sellAmount: string;
  buyAmount: string;
  slippageTolerance: number;
}

export interface SwapResult {
  transactionHash: string;
  amountIn: string;
  amountOut: string;
  tokenIn: string;
  tokenOut: string;
  timestamp: number;
}

export interface SwapError {
  code: string;
  message: string;
  details?: any;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
}

// Available tokens for swapping (based on your wallet assets)
export const AVAILABLE_SWAP_TOKENS: TokenInfo[] = [
  {
    address: 'GB55TEPZCAPVA5QKOGTKEBLGJNCP4LSEIM65PMKYKVTABMFCKQNKPJ2H',
    symbol: 'nBTC',
    name: 'nBTC',
    decimals: 8,
  },
  {
    address: 'GB55TEPZCAPVA5QKOGTKEBLGJNCP4LSEIM65PMKYKVTABMFCKQNKPJ2H',
    symbol: 'nETH',
    name: 'nETH',
    decimals: 18,
  },
  {
    address: 'GB55TEPZCAPVA5QKOGTKEBLGJNCP4LSEIM65PMKYKVTABMFCKQNKPJ2H',
    symbol: 'nSOL',
    name: 'nSOL',
    decimals: 9,
  },
  {
    address: 'native',
    symbol: 'XLM',
    name: 'Stellar Lumens',
    decimals: 7,
  },
];

// Mock contract addresses - to be replaced with real addresses
export const SWAP_CONTRACT_ADDRESSES = {
  SWAP_UTILITY: 'SWAP_UTILITY_CONTRACT_MOCK_ADDRESS',
  SOROSWAP_ROUTER: 'SOROSWAP_ROUTER_MOCK_ADDRESS',
  TOKENS: {
    USDC: 'USDC_MOCK_ADDRESS',
    BTC: 'BTC_MOCK_ADDRESS', 
    ETH: 'ETH_MOCK_ADDRESS',
    XLM: 'native',
  }
};