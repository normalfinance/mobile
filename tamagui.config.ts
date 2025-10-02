import { createTamagui, createFont, CreateTamaguiProps } from "tamagui";
import { defaultConfig } from "@tamagui/config/v4";

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

const satoshiFont = createFont({
  family: "Satoshi-Regular",
  face: {
    300: { normal: "Satoshi-Light" },
    400: { normal: "Satoshi-Regular" },
    500: { normal: "Satoshi-Medium" },
    700: { normal: "Satoshi-Bold" },
    900: { normal: "Satoshi-Black" }
  },
  size: {
    1: 14,
    2: 16,
    3: 18,
    4: 20,
    5: 24,
    6: 28,
    7: 32,
    8: 38,
    9: 44,
    10: 52
  },
  lineHeight: {
    1: 20,
    2: 22,
    3: 24,
    4: 28,
    5: 32,
    6: 36,
    7: 40,
    8: 46,
    9: 52,
    10: 58
  },
  weight: {
    1: "300",
    2: "300",
    3: "400",
    4: "400",
    5: "500",
    6: "500",
    7: "700",
    8: "700",
    9: "900",
    10: "900"
  },
  letterSpacing: {
    1: 0,
    2: -0.1,
    3: -0.15,
    4: -0.2,
    5: -0.25,
    6: -0.3,
    7: -0.35,
    8: -0.4,
    9: -0.45,
    10: -0.5
  }
});

const satoshiBodyFont = createFont({
  family: "Satoshi-Regular",
  face: {
    300: { normal: "Satoshi-Light" },
    400: { normal: "Satoshi-Regular" },
    500: { normal: "Satoshi-Medium" },
    700: { normal: "Satoshi-Bold" },
    900: { normal: "Satoshi-Black" }
  },
  size: {
    1: 12,
    2: 14,
    3: 16,
    4: 18,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40
  },
  lineHeight: {
    1: 18,
    2: 20,
    3: 24,
    4: 28,
    5: 30,
    6: 34,
    7: 38,
    8: 42,
    9: 46,
    10: 50
  },
  weight: {
    1: "300",
    2: "300",
    3: "400",
    4: "400",
    5: "500",
    6: "500",
    7: "700",
    8: "700",
    9: "900",
    10: "900"
  },
  letterSpacing: {
    1: 0.1,
    2: 0.12,
    3: 0.15,
    4: 0.18,
    5: 0.2,
    6: 0.22,
    7: 0.24,
    8: 0.26,
    9: 0.28,
    10: 0.3
  }
});

const barlowFont = createFont({
  family: "Barlow-Regular",
  face: {
    100: { normal: "Barlow-Thin" },
    200: { normal: "Barlow-ExtraLight" },
    300: { normal: "Barlow-Light" },
    400: { normal: "Barlow-Regular" },
    500: { normal: "Barlow-Medium" },
    600: { normal: "Barlow-SemiBold" },
    700: { normal: "Barlow-Bold" },
    800: { normal: "Barlow-ExtraBold" },
    900: { normal: "Barlow-Black" }
  },
  size: {
    1: 12,
    2: 14,
    3: 16,
    4: 18,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40
  },
  lineHeight: {
    1: 18,
    2: 20,
    3: 24,
    4: 28,
    5: 30,
    6: 34,
    7: 38,
    8: 42,
    9: 46,
    10: 50
  },
  weight: {
    1: "100",
    2: "200",
    3: "300",
    4: "400",
    5: "500",
    6: "600",
    7: "700",
    8: "800",
    9: "900",
    10: "900"
  },
  letterSpacing: {
    1: 0.05,
    2: 0.1,
    3: 0.15,
    4: 0.2,
    5: 0.25,
    6: 0.3,
    7: 0.35,
    8: 0.4,
    9: 0.45,
    10: 0.5
  }
});

const tokens = {
  ...baseTokens,
  color: {
    ...baseColorTokens,
    brandPrimary: "#0A7EA4",
    brandPrimaryHover: "#086080",
    brandSecondary: "#151718",
    brandSurface: "#E6F4FE",
    success: "#12B76A",
    warning: "#F79009",
    danger: "#F04438"
  },
  space: {
    ...baseTokens.space,
    section: 24,
    page: 32
  },
  radius: {
    ...baseTokens.radius,
    card: 16
  }
} as BaseTokens;

const themes = {
  ...baseThemes,
  light: {
    ...baseThemes.light,
    background: "#FFFFFF",
    backgroundHover: "#F8FAFC",
    backgroundPress: "#EEF2FF",
    backgroundFocus: "#E6F4FE",
    color: "#11181C",
    colorHover: "#0A7EA4",
    colorPress: "#086080",
    colorFocus: "#0A7EA4",
    borderColor: "#CBD5F5",
    shadowColor: "#0A7EA433",
    accentColor: "#0A7EA4"
  },
  dark: {
    ...baseThemes.dark,
    background: "#0F172A",
    backgroundHover: "#111C34",
    backgroundPress: "#0A1624",
    backgroundFocus: "#142038",
    color: "#ECEDEE",
    colorHover: "#38BDF8",
    colorPress: "#0EA5E9",
    colorFocus: "#38BDF8",
    borderColor: "#1E293B",
    shadowColor: "#0A7EA480",
    accentColor: "#38BDF8"
  },
  brand: {
    ...baseThemes.light,
    background: "#E6F4FE",
    backgroundHover: "#D5EBFC",
    backgroundPress: "#C4E2FB",
    backgroundFocus: "#B3D9F9",
    color: "#0A7EA4",
    colorHover: "#086080",
    colorPress: "#064B62",
    colorFocus: "#086080",
    borderColor: "#BFDDF4",
    shadowColor: "#0A7EA433",
    accentColor: "#0A7EA4"
  }
};

const fonts = {
  ...baseFonts,
  heading: satoshiFont,
  body: satoshiBodyFont,
  text: satoshiFont,
  numeric: barlowFont,
  mono: barlowFont
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
