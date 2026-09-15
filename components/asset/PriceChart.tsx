// Price chart for the asset page. Two things the previous version got wrong:
// the y-axis started at $0, so a 1D/1W series (±1%) rendered as a flat line
// pinned to the top; and there were no axis values at all. Now the y-range is
// the series' own min–max with 8% headroom (a flat series gets ±0.5% so it
// sits centred), three dashed rules with price labels on the right, and four
// time labels along the bottom formatted for the selected period.
// Same ink line + soft area fade as before; labels are faint Geist Mono.

import React from "react";
import { LineChart } from "react-native-gifted-charts";
import { yAxisSides } from "gifted-charts-core";

import { useColors } from "@/lib/theme/appearance";
import { fCurrencyTwoDecimals } from "@/lib/utils/number-format.utils";
import type { PortfolioPeriod } from "@/services/portfolio.service";

const Y_LABEL_WIDTH = 56;
const SECTIONS = 3;
const X_LABEL_POSITIONS = [0.1, 0.37, 0.63, 0.9];

const formatTime = (ts: number, period: PortfolioPeriod): string => {
  const d = new Date(ts);
  switch (period) {
    case "1D":
      return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    case "7D":
      return d.toLocaleDateString(undefined, { weekday: "short" });
    case "30D":
      return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
    case "365D":
      return d.toLocaleDateString(undefined, { month: "short" });
    default: // 5Y, All
      return String(d.getFullYear());
  }
};

/** Compact price for the axis: cents under $10, whole dollars above $1k. */
const formatAxisPrice = (v: number): string => {
  if (v >= 1000) return `$${Math.round(v).toLocaleString()}`;
  if (v >= 10) return `$${v.toFixed(1)}`;
  return fCurrencyTwoDecimals(v);
};

export const PriceChart = ({
  points,
  period,
  width,
  height = 170
}: {
  points: [number, number][];
  period: PortfolioPeriod;
  width: number;
  height?: number;
}) => {
  const c = useColors();

  const { data, yMin, yMax } = React.useMemo(() => {
    const values = points.map(([, v]) => v);
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    const span = hi - lo;
    // 8% headroom; a flat series (stablecoin) gets ±0.5% so the line is centred.
    const pad = span > 0 ? span * 0.08 : Math.max(hi * 0.005, 0.01);
    lo -= pad;
    hi += pad;
    const n = points.length;
    const labelAt = new Map<number, string>();
    if (n > 1) {
      for (const f of X_LABEL_POSITIONS) labelAt.set(Math.round(f * (n - 1)), formatTime(points[Math.round(f * (n - 1))][0], period));
    }
    return {
      yMin: lo,
      yMax: hi,
      data: points.map(([, v], i) => ({
        value: v,
        label: labelAt.get(i) ?? "",
        labelTextStyle: { color: c.faint, fontSize: 10, fontFamily: "GeistMono-Regular", width: 56, textAlign: "center" as const }
      }))
    };
  }, [points, period, c.faint]);

  const yLabels = Array.from({ length: SECTIONS + 1 }, (_, i) => formatAxisPrice(yMin + ((yMax - yMin) * i) / SECTIONS));
  const plotWidth = width - Y_LABEL_WIDTH;

  return (
    <LineChart
      data={data}
      width={plotWidth}
      height={height}
      color={c.ink}
      thickness={2}
      curved
      hideDataPoints
      areaChart
      startFillColor={c.ink}
      startOpacity={0.08}
      endFillColor={c.surface}
      endOpacity={0}
      initialSpacing={0}
      endSpacing={0}
      spacing={plotWidth / Math.max(1, data.length - 1)}
      disableScroll
      adjustToWidth
      // y-axis: the series' own range, labels on the right, no axis line
      yAxisOffset={yMin}
      maxValue={yMax - yMin}
      noOfSections={SECTIONS}
      yAxisLabelTexts={yLabels}
      yAxisSide={yAxisSides.RIGHT}
      yAxisLabelWidth={Y_LABEL_WIDTH}
      yAxisTextStyle={{ color: c.faint, fontSize: 10, fontFamily: "GeistMono-Regular" }}
      yAxisLabelContainerStyle={{ paddingLeft: 8 }}
      yAxisThickness={0}
      // rules: hairline dashes on the divider colour
      rulesType='dashed'
      rulesColor={c.divider}
      rulesThickness={1}
      dashWidth={4}
      dashGap={4}
      // x-axis: four time labels, no axis line
      xAxisThickness={0}
      xAxisLabelsHeight={18}
      xAxisLabelsVerticalShift={4}
    />
  );
};
