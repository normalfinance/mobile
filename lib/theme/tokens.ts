// The design contract for product surfaces. Mirrors the web app's ACCOUNT
// DRAWER (packages/web/src/components/_common/drawer-components/*), which is
// Niko's spec — not the MUI theme. Every value below is copied from those
// files' `sx` blocks; see docs/web-agent-answers.md "Design system (D1–D12)".
//
// Rules that follow from it:
//   - text and solid buttons are `ink`, never grey[800] and never palette blue
//   - every number, amount and address is Geist Mono with -0.01em tracking
//   - cards are white with a 1px border and NO shadow
//   - exactly one press state everywhere: `pressTint`
//   - positive amounts are `positive`; negatives stay ink (no red)

export const ink = {
  ink: "#0A0A0F",
  ink2: "#2A2A33",
  muted: "#6B6B76",
  faint: "#9A9AA5",
  surface: "#FFFFFF",
  iconBg: "#F4F4F7",
  inputBg: "#FAFAFB",
  divider: "rgba(10,10,15,0.06)",
  border: "rgba(10,10,15,0.08)",
  borderStrong: "rgba(10,10,15,0.14)",
  pressTint: "rgba(10,10,15,0.03)",
  iconPressTint: "rgba(10,10,15,0.04)",
  iconCircle: "rgba(10,10,15,0.06)",
  body50: "rgba(10,10,15,0.5)",
  ctaPressed: "#1a1a25",
  ctaDisabledBg: "rgba(10,10,15,0.08)",
  ctaDisabledText: "rgba(10,10,15,0.3)",
  positive: "#1AB37D",
  failed: "#7A1D4A"
} as const;

/** Activity / status chips: text colour on a translucent background. */
export const chips = {
  green: { color: "#0A6649", bg: "rgba(26,179,125,0.11)" },
  amber: { color: "#8A4A00", bg: "rgba(255,176,96,0.16)" },
  blue: { color: "#0A5272", bg: "rgba(91,207,255,0.14)" },
  purple: { color: "#5A2E9E", bg: "rgba(177,123,255,0.13)" },
  neutral: { color: "#2A2A33", bg: "rgba(10,10,15,0.07)" }
} as const;
export type ChipTone = keyof typeof chips;

/** Logo / avatar / CTA-shine only. Never for text. */
export const brandGradient = {
  colors: ["#5BCFFF", "#6E8BFF", "#B17BFF", "#FF7BC5", "#FFB060"],
  locations: [0, 0.28, 0.55, 0.78, 1]
} as const;

/** From web lib/chains/registry.ts brandColor. */
export const chainColors = {
  BTC: "#F7931A",
  ETH: "#627EEA",
  SOL: "#9945FF",
  XLM: "#14B8A6",
  USDC: "#2775CA"
} as const;

export const radius = {
  card: 16,
  row: 12,
  tile: 12,
  cta: 12,
  iconBox: 8,
  dialog: 22,
  pill: 999,
  chip: 6,
  smallButton: 10,
  input: 12
} as const;

export const space = {
  gutter: 16,
  section: 20,
  cardInner: 16,
  rowX: 14,
  rowY: 12,
  rowGap: 12,
  tileGap: 6,
  touchTarget: 44
} as const;

/** Type sizes from the drawer. Weights: 400 / 500 / 600 / 700 only. */
export const typeScale = {
  name: { size: 15, weight: "600" },
  email: { size: 13 },
  totalLabel: { size: 14, weight: "500" },
  total: { size: 22, weight: "400", mono: true },
  rowLabel: { size: 13.5 },
  rowValue: { size: 15, weight: "400", mono: true },
  assetName: { size: 14, weight: "600" },
  assetSub: { size: 12 },
  assetUsd: { size: 14, weight: "400", mono: true },
  assetQty: { size: 11.5, mono: true },
  actionLabel: { size: 12, weight: "500" },
  tab: { size: 13.5, weight: "500" },
  pill: { size: 12, weight: "600" },
  chip: { size: 11, weight: "600" },
  footnote: { size: 11, mono: true },
  cta: { size: 15, weight: "700" },
  emptyTitle: { size: 16, weight: "500" },
  body: { size: 14 }
} as const;

/** -0.01em, expressed in points for a given font size (RN takes absolute values). */
export const tracking = (fontSize: number) => -0.01 * fontSize;
