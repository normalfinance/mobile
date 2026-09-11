// Ported from normal-v1-interface packages/web/src/utils/format-number.ts
// @ 6a403a8d (2026-09-11), with the locale passed in instead of read from
// i18next. Same Intl.NumberFormat options, so web and mobile print the same
// strings for the same numbers.
//
//   fCurrencyTwoDecimals → totals, wallet / savings values (always 2 dp)
//   fCurrency            → row USD values (0–2 dp)
//   fTokenAmount         → on-chain quantities (0–7 dp, trailing zeros trimmed)
//   fPercent, fNumber, fCurrencyCompact

export type InputNumberValue = string | number | null | undefined;

export interface NumberLocale {
  code: string;
  currency: string;
}

export const DEFAULT_LOCALE: NumberLocale = { code: "en-US", currency: "USD" };

type Options = Intl.NumberFormatOptions;

const processInput = (value: InputNumberValue): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

export const fNumber = (
  value: InputNumberValue,
  options?: Options,
  locale: NumberLocale = DEFAULT_LOCALE
): string => {
  const n = processInput(value);
  if (n === null) return "";
  return new Intl.NumberFormat(locale.code, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options
  }).format(n);
};

export const fCurrency = (
  value: InputNumberValue,
  options?: Options,
  locale: NumberLocale = DEFAULT_LOCALE
): string => {
  const n = processInput(value);
  if (n === null) return "";
  return new Intl.NumberFormat(locale.code, {
    style: "currency",
    currency: locale.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options
  }).format(n);
};

export const fCurrencyTwoDecimals = (
  value: InputNumberValue,
  options?: Options,
  locale: NumberLocale = DEFAULT_LOCALE
): string => {
  const n = processInput(value);
  if (n === null) return "";
  return new Intl.NumberFormat(locale.code, {
    style: "currency",
    currency: locale.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options
  }).format(n);
};

export const fCurrencyCompact = (
  value: InputNumberValue,
  options?: Options,
  locale: NumberLocale = DEFAULT_LOCALE
): string => {
  const n = processInput(value);
  if (n === null) return "";
  return new Intl.NumberFormat(locale.code, {
    style: "currency",
    currency: locale.currency,
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options
  }).format(n);
};

export const fPercent = (
  value: InputNumberValue,
  options?: Options,
  locale: NumberLocale = DEFAULT_LOCALE
): string => {
  const n = processInput(value);
  if (n === null) return "";
  return new Intl.NumberFormat(locale.code, {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
    ...options
  }).format(n / 100);
};

export const fTokenAmount = (
  value: InputNumberValue,
  options?: Options,
  locale: NumberLocale = DEFAULT_LOCALE
): string => {
  const n = processInput(value);
  if (n === null) return "";
  return new Intl.NumberFormat(locale.code, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 7,
    ...options
  }).format(n);
};

/**
 * Display-decimals policy (mobile's choice — web has no single rule, D5).
 * Trailing zeros are trimmed by Intl since minimumFractionDigits is 0.
 */
export const DISPLAY_DECIMALS: Record<string, number> = {
  BTC: 8,
  ETH: 6,
  SOL: 4,
  XLM: 4,
  USDC: 2
};

export const fAssetQuantity = (
  value: InputNumberValue,
  symbol: string,
  locale: NumberLocale = DEFAULT_LOCALE
): string =>
  fTokenAmount(
    value,
    { maximumFractionDigits: DISPLAY_DECIMALS[symbol] ?? 7 },
    locale
  );

/** `GABC…WXYZ` — the drawer shows addresses shortened, in mono. */
export const shortenAddress = (
  address: string | null | undefined,
  head = 4,
  tail = 4
): string => {
  if (!address) return "";
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
};
