// Stripe fiat-to-crypto onramp via server sessions (web, live 2026-10-09):
//   POST /api/stripe/onramp-session { address, asset, blockchain, amountUsd? }
//     200 { success, url, sessionId }   url = Stripe's hosted page, wallet address
//                                        locked, one asset/network, USD amount prefilled
//     400 { error }                      unsupported pair / Stripe refused
//                                        ("Stripe is not available in your region yet.")
//     503 { notConfigured: true }        key not set in this environment → hide Stripe
// Tracking: POST ramp/transfers { provider:'stripe', providerRef: sessionId } BEFORE
// opening the page — the Stripe webhook advances that row; arrival is still the
// chain's balance rise. No redirect comes back from Stripe's page.
// Pairs (Stripe docs): stellar→XLM|USDC, bitcoin→BTC, ethereum→ETH|USDC, solana→SOL|USDC.

import type { WalletChain } from "@/hooks/use-turnkey-wallet";
import { ApiError, apiFetch } from "@/lib/api";

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("Stripe is not configured in this environment.");
    this.name = "StripeNotConfigured";
  }
}

export const createStripeOnrampSession = async (p: { address: string; asset: string; blockchain: WalletChain; amountUsd?: number }): Promise<{ url: string; sessionId: string }> => {
  try {
    const d = await apiFetch<{ success?: boolean; url?: string; sessionId?: string; error?: string }>("/api/stripe/onramp-session", {
      body: { address: p.address, asset: p.asset, blockchain: p.blockchain, ...(p.amountUsd ? { amountUsd: p.amountUsd.toFixed(2) } : {}) }
    });
    if (!d.url || !d.sessionId) throw new Error(d.error || "Stripe did not return a checkout page.");
    return { url: d.url, sessionId: d.sessionId };
  } catch (e) {
    if (e instanceof ApiError && e.status === 503) throw new StripeNotConfiguredError();
    throw e;
  }
};

/** The old static link (no destination address) — kept only as the last-resort fallback. */
export const createStripeURL = (amountUsd: number | string, destinationCurrency = "usdc", destinationNetwork = "stellar"): string =>
  `https://crypto.link.com?source_amount=${String(amountUsd ?? "0")}&source_currency=usd&destination_currency=${destinationCurrency}&destination_network=${destinationNetwork}`;
