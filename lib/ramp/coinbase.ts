// Buy crypto with Coinbase Onramp — port of web onramp-dialog.tsx +
// packages/utils onramp/coinbase.ts + app/api/coinbase/session/route.ts.
//
//   POST /api/coinbase/session { address, asset, blockchain } → { token }
//     (server signs a CDP JWT; the session token is single-use, short-lived)
//   URL: https://pay.coinbase.com/buy?presetFiatAmount&fiatCurrency&defaultAsset
//        &sessionToken&redirectUrl        (built client-side, web utils)
//   POST /api/ramp/transfers { direction:'onramp', provider:'coinbase', asset,
//        chain, walletAddress, amountExpected?, baselineBalance? } → { id }
//     one live handoff per (provider, asset, wallet); the server flips it to
//     'arrived' when the chain balance rises past the baseline (GET ?active=1).
//
// The redirectUrl must be on Coinbase's CDP allow-list (an account task —
// same owner as the Turnstile widget). Until `normalapp://buy` is listed,
// Coinbase shows its own "return to app" page; the purchase still lands.

import { apiFetch } from "@/lib/api";
import type { WalletChain } from "@/hooks/use-turnkey-wallet";

export type BuyAsset = "USDC" | "XLM" | "BTC" | "ETH" | "SOL";

export const BUY_ASSETS: { asset: BuyAsset; chain: WalletChain; label: string }[] = [
  { asset: "USDC", chain: "stellar", label: "USDC on Stellar" },
  { asset: "XLM", chain: "stellar", label: "Stellar Lumens" },
  { asset: "BTC", chain: "bitcoin", label: "Bitcoin" },
  { asset: "ETH", chain: "ethereum", label: "Ethereum" },
  { asset: "SOL", chain: "solana", label: "Solana" }
];

export const BUY_PRESETS_USD = [20, 50, 100, 250];
export const BUY_RETURN_URL = "normalapp://buy";

export const createCoinbaseSession = async (address: string, asset: BuyAsset, blockchain: WalletChain): Promise<string> => {
  const data = await apiFetch<{ token?: string; error?: unknown }>("/api/coinbase/session", {
    body: { address, asset, blockchain }
  });
  if (!data?.token) throw new Error("Coinbase did not start a checkout session. Try again in a moment.");
  return data.token;
};

/** Verbatim web createCoinbasePayOnrampURL (mainnet only here). */
export const createCoinbasePayOnrampURL = (opts: {
  amountUsd: number | string;
  assetSymbol: string;
  sessionToken: string;
  fiat?: string;
  path?: string;
  redirectUrl?: string;
}): string => {
  const { amountUsd, assetSymbol, sessionToken, fiat = "USD", path = "buy", redirectUrl } = opts;
  const params = new URLSearchParams({
    presetFiatAmount: String(amountUsd),
    fiatCurrency: fiat,
    defaultAsset: assetSymbol,
    sessionToken
  });
  if (redirectUrl) params.set("redirectUrl", redirectUrl);
  return `https://pay.coinbase.com/${path}?${params.toString()}`;
};

/** Best-effort tracking row; a failure must never block the purchase (web). */
export const recordOnrampHandoff = async (params: {
  asset: BuyAsset;
  chain: WalletChain;
  walletAddress: string;
  amountUsd: number;
  baselineBalance: number | null;
}): Promise<string | null> => {
  try {
    const data = await apiFetch<{ success: boolean; id?: string }>("/api/ramp/transfers", {
      body: {
        direction: "onramp",
        provider: "coinbase",
        asset: params.asset,
        chain: params.chain,
        walletAddress: params.walletAddress,
        network: "mainnet",
        amountExpected: null, // fiat preset ≠ crypto amount; the server watches the balance
        baselineBalance: params.baselineBalance != null ? String(params.baselineBalance) : null
      }
    });
    return data?.id ?? null;
  } catch {
    return null;
  }
};

export interface RampTransfer {
  id: string;
  direction: "onramp" | "offramp";
  provider: string;
  asset: string;
  chain: WalletChain;
  status: string;
  amountExpected: string | null;
  createdAt: string;
}

export const fetchActiveRamps = async (): Promise<RampTransfer[]> => {
  const data = await apiFetch<{ success?: boolean; transfers?: RampTransfer[] }>("/api/ramp/transfers", {
    query: { active: 1 }
  });
  return data?.transfers ?? [];
};
