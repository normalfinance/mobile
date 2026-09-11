// Ported from normal-v1-interface packages/utils/src/cdn.ts and
// packages/utils/src/ui.ts (getCryptoIconUrl) @ 6a403a8d, 2026-09-11.
// Same rules, same file names, so web and mobile show identical icons:
//   - native chains are stored by NAME: tokens/bitcoin.webp, ethereum, solana
//   - XLM and every other ticker by TICKER: tokens/XLM.webp, tokens/USDC.webp
//   - discontinued Normal tokens (nXXX) lived under tokens/normal/*.svg
// All five v1 assets verified live on the CDN on 2026-09-11.

const CDN_BASE = (process.env.EXPO_PUBLIC_CDN_URL ?? "").replace(/\/+$/, "");

export const cdn = (path: string): string => {
  const p = path.replace(/^\/+/, "");
  return CDN_BASE ? `${CDN_BASE}/${p}` : "";
};

const NATIVE_ICON_FILES: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana"
};

export const getCryptoIconUrl = (symbol: string): string => {
  if (!symbol) return "";

  const sanitized = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (sanitized === "XLM") {
    return cdn("/tokens/XLM.webp");
  }

  if (NATIVE_ICON_FILES[sanitized]) {
    return cdn(`/tokens/${NATIVE_ICON_FILES[sanitized]}.webp`);
  }

  // Legacy Normal-token rule kept for parity with web; these assets are
  // discontinued and should not appear in the app.
  const isNormalToken = /^n[A-Z0-9]/.test(symbol);
  const fileName = isNormalToken ? `n${sanitized.slice(1)}` : sanitized;

  return isNormalToken
    ? cdn(`/tokens/normal/${fileName}.svg`)
    : cdn(`/tokens/${fileName}.webp`);
};

/** Brand assets used by the app. Same files the web app uses. */
export const BRAND_ASSETS = {
  logoSingleSvg: () => cdn("/logo/logo-single.svg"),
  logoSinglePng: () => cdn("/logo/logo-single.png"),
  logoFullSvg: () => cdn("/logo/logo-full.svg"),
  emptyState: () => cdn("/icons/empty/ic_content.svg"),
  moneygram: () => cdn("/icons/moneygram/mgi.webp")
} as const;
