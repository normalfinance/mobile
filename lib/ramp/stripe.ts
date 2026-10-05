// Verbatim port of web utils/onramp/stripe.ts. A static link: Stripe's onramp
// application is not approved, so the URL cannot carry a destination address —
// the user enters their wallet address on Stripe's page (web, Niko 2026-08-26).

export const createStripeURL = (amountUsd: number | string, destinationCurrency = "usdc", destinationNetwork = "stellar"): string =>
  `https://crypto.link.com?source_amount=${String(amountUsd ?? "0")}&source_currency=usd&destination_currency=${destinationCurrency}&destination_network=${destinationNetwork}`;
