import { createTamagui, createFont, CreateTamaguiProps } from "tamagui";
import { config as defaultConfig } from "@tamagui/config";

import { ink, inkDark } from "./lib/theme/tokens";

const {
  themes: baseThemes,
  tokens: baseTokens,
  fonts: baseFonts
} = defaultConfig;

type BaseTokens = typeof baseTokens;
type BaseColorTokens = BaseTokens extends { color: infer C }
  ? C
  : Record<string, string>;

const baseColorTokens =
  (baseTokens as BaseTokens & { color?: BaseColorTokens }).color ??
  ({} as BaseColorTokens);

// ---------------------------------------------------------------------------
// Fonts. Web: Satoshi for UI (Fontshare, weights 400/500/600/700 in practice)
// and Geist Mono for every number, amount and address. Satoshi ships no static
// 600 cut (web gets it from the variable font), so 600 maps to Bold here.
// ---------------------------------------------------------------------------

const sizes = {
  1: 11,
  2: 12,
  3: 13,
  4: 14,
  5: 15,
  6: 16,
  7: 18,
  8: 22,
  9: 28,
  10: 32,
  11: 40
} as const;

const lineHeights = {
  1: 14,
  2: 16,
  3: 18,
  4: 20,
  5: 20,
  6: 22,
  7: 24,
  8: 28,
  9: 34,
  10: 38,
  11: 46
} as const;

const satoshiFont = createFont({
  family: "Satoshi-Regular",
  face: {
    300: { normal: "Satoshi-Regular" },
    400: { normal: "Satoshi-Regular" },
    500: { normal: "Satoshi-Medium" },
    600: { normal: "Satoshi-Bold" },
    700: { normal: "Satoshi-Bold" },
    800: { normal: "Satoshi-Bold" },
    900: { normal: "Satoshi-Bold" }
  },
  size: sizes,
  lineHeight: lineHeights,
  weight: {
    1: "400",
    2: "400",
    3: "400",
    4: "400",
    5: "400",
    6: "500",
    7: "500",
    8: "600",
    9: "700",
    10: "700",
    11: "700"
  },
  letterSpacing: {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: -0.15,
    6: -0.16,
    7: -0.18,
    8: -0.22,
    9: -0.28,
    10: -0.32,
    11: -0.4
  }
});

// -0.01em tracking, tabular figures: the drawer's MONO style.
const geistMonoFont = createFont({
  family: "GeistMono-Regular",
  face: {
    300: { normal: "GeistMono-Regular" },
    400: { normal: "GeistMono-Regular" },
    500: { normal: "GeistMono-Medium" },
    600: { normal: "GeistMono-Bold" },
    700: { normal: "GeistMono-Bold" },
    800: { normal: "GeistMono-Bold" },
    900: { normal: "GeistMono-Bold" }
  },
  size: sizes,
  lineHeight: lineHeights,
  weight: {
    1: "400",
    2: "400",
    3: "400",
    4: "400",
    5: "400",
    6: "400",
    7: "400",
    8: "400",
    9: "500",
    10: "500",
    11: "500"
  },
  letterSpacing: {
    1: -0.11,
    2: -0.12,
    3: -0.13,
    4: -0.14,
    5: -0.15,
    6: -0.16,
    7: -0.18,
    8: -0.22,
    9: -0.28,
    10: -0.32,
    11: -0.4
  }
});

// ---------------------------------------------------------------------------
// Tokens. New names are the ink system; the old names the prototype screens
// still reference ($textSecondary, $purple500, …) are kept but re-pointed at
// the closest value from the drawer so legacy screens drift toward the spec.
// ---------------------------------------------------------------------------

const tokens = {
  ...baseTokens,
  color: {
    ...baseColorTokens,
    // ink system (docs/web-agent-answers.md D-colors)
    ink: ink.ink,
    ink2: ink.ink2,
    muted: ink.muted,
    faint: ink.faint,
    surface: ink.surface,
    iconBg: ink.iconBg,
    inputBg: ink.inputBg,
    divider: ink.divider,
    border: ink.border,
    pressTint: ink.pressTint,
    positive: ink.positive,
    failed: ink.failed,

    // legacy names, re-pointed
    brandPrimary: ink.ink,
    brandPrimaryHover: ink.ctaPressed,
    brandSecondary: ink.ink2,
    brandSurface: ink.iconBg,
    success: ink.positive,
    warning: "#8A4A00",
    danger: ink.failed,
    buttonColor: ink.ink,
    purple500: "#6E4BFF",
    purple600: "#4B29DB",
    purple700: "#30189C",
    purple50: ink.iconBg,
    purple100: "rgba(148,123,255,0.29)",
    cardBackground: ink.surface,
    pageBackground: ink.surface,
    sectionBackground: ink.iconBg,
    inputBackground: ink.inputBg,
    textPrimary: ink.ink,
    textSecondary: ink.muted,
    textTertiary: ink.faint
  },
  space: {
    ...baseTokens.space,
    gutter: 16,
    section: 20,
    page: 16,
    cardPadding: 16,
    sectionPadding: 16
  },
  radius: {
    ...baseTokens.radius,
    card: 16,
    row: 12,
    button: 12,
    iconBox: 8,
    dialog: 22,
    input: 12,
    pill: 999
  }
} as BaseTokens;

const themes = {
  ...baseThemes,
  light: {
    ...baseThemes.light,
    background: ink.surface,
    backgroundHover: ink.surface,
    backgroundPress: ink.pressTint,
    backgroundFocus: ink.surface,
    color: ink.ink,
    colorHover: ink.ink,
    colorPress: ink.ink2,
    colorFocus: ink.ink,
    borderColor: ink.border,
    shadowColor: "transparent",
    accentColor: ink.ink,
    buttonColor: ink.ink,
    cardBackground: ink.surface,
    pageBackground: ink.surface,
    sectionBackground: ink.iconBg,
    textPrimary: ink.ink,
    textSecondary: ink.muted,
    textTertiary: ink.faint
  },
  // Derived dark palette (lib/theme/tokens.ts inkDark); chosen in Settings.
  dark: {
    ...baseThemes.dark,
    background: inkDark.surface,
    backgroundHover: inkDark.surface,
    backgroundPress: inkDark.pressTint,
    backgroundFocus: inkDark.surface,
    color: inkDark.ink,
    colorHover: inkDark.ink,
    colorPress: inkDark.ink2,
    colorFocus: inkDark.ink,
    borderColor: inkDark.border,
    shadowColor: "transparent",
    accentColor: inkDark.ink,
    buttonColor: inkDark.cta,
    cardBackground: inkDark.surface,
    pageBackground: inkDark.surface,
    sectionBackground: inkDark.iconBg,
    textPrimary: inkDark.ink,
    textSecondary: inkDark.muted,
    textTertiary: inkDark.faint
  }
};

const fonts = {
  ...baseFonts,
  heading: satoshiFont,
  body: satoshiFont,
  text: satoshiFont,
  // every number / amount / address
  mono: geistMonoFont,
  numeric: geistMonoFont
};

export const config = createTamagui({
  ...defaultConfig,
  fonts,
  tokens,
  themes
} as CreateTamaguiProps);

export type AppConfig = typeof config;

declare module "tamagui" {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config;
