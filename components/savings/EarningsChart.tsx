// Web sections/savings/savings-chart.tsx on the app's chart idiom
// (components/asset/PriceChart.tsx): the REAL earnings curve from the
// wallet's DeFindex events, a period stat ("7 days · +$0.01234") and the
// seven window pills. A failed history fetch says so instead of drawing a
// flat $0 curve as if it were the user's earnings (web Doc 90 W3).

import React from "react";
import { LineChart } from "react-native-gifted-charts";
import { yAxisSides } from "gifted-charts-core";
import { XStack, YStack } from "tamagui";

import { Mono, Skeleton, UiText } from "@/components/home/primitives";
import { useSavingsHistory } from "@/hooks/use-savings-history";
import {
  buildRealEarningsHistory,
  filterByWindow,
  fmtEarningsAxis,
  fmtEarningsStat,
  getPeriodEarnings,
  PERIOD_LABEL,
  TIME_FILTERS,
  WINDOW_MS,
  type TimeFilter
} from "@/lib/savings/earnings-history";
import { useColors } from "@/lib/theme/appearance";
import { radius, space } from "@/lib/theme/tokens";

const Y_LABEL_WIDTH = 60;
const SECTIONS = 3;
const NUM_POINTS = 80;
const X_LABEL_POSITIONS = [0.1, 0.37, 0.63, 0.9];

const fmtDate = (t: number, now: number): string => {
  const diff = now - t;
  const d = new Date(t);
  if (diff < 7 * 24 * 3600 * 1000) return d.toLocaleDateString(undefined, { weekday: "short" });
  if (diff < 365 * 24 * 3600 * 1000) return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
};

export const EarningsChart = ({ address, currentEarnings, width, height = 150 }: { address: string; currentEarnings: number; width: number; height?: number }) => {
  const c = useColors();
  const [filter, setFilter] = React.useState<TimeFilter>("1W");
  const { events, isLoading, error } = useSavingsHistory(address);
  const now = React.useMemo(() => Date.now(), [events]); // eslint-disable-line react-hooks/exhaustive-deps

  const allPoints = React.useMemo(() => buildRealEarningsHistory(events, currentEarnings, now, NUM_POINTS), [events, currentEarnings, now]);
  const chartPoints = React.useMemo(() => filterByWindow(allPoints, filter, now), [allPoints, filter, now]);
  const periodEarnings = filter === "ALL" ? currentEarnings : getPeriodEarnings(allPoints, WINDOW_MS[filter]!, now);

  const { data, yMin, yMax } = React.useMemo(() => {
    const values = chartPoints.map((p) => p.v);
    // Web: tight y-range scaled to the visible data, never 0 → global max.
    const lo0 = values.length ? Math.min(...values) : 0;
    const hi0 = Math.max(...values, 0.0001);
    const pad = Math.max((hi0 - lo0) * 0.18, 0.000001);
    const lo = Math.max(0, lo0 - pad * 0.4);
    const hi = hi0 + pad;
    const n = chartPoints.length;
    const labelAt = new Map<number, string>();
    if (n > 1) for (const f of X_LABEL_POSITIONS) labelAt.set(Math.round(f * (n - 1)), fmtDate(chartPoints[Math.round(f * (n - 1))].t, now));
    return {
      yMin: lo,
      yMax: hi,
      data: chartPoints.map((p, i) => ({
        value: p.v,
        label: labelAt.get(i) ?? "",
        labelTextStyle: { color: c.faint, fontSize: 10, fontFamily: "GeistMono-Regular", width: 56, textAlign: "center" as const }
      }))
    };
  }, [chartPoints, now, c.faint]);

  const yLabels = Array.from({ length: SECTIONS + 1 }, (_, i) => fmtEarningsAxis(yMin + ((yMax - yMin) * i) / SECTIONS));
  const plotWidth = width - Y_LABEL_WIDTH;
  const failed = !!error && events.length === 0 && !isLoading;
  const empty = !isLoading && !failed && allPoints.length === 0;

  return (
    <YStack>
      <XStack paddingHorizontal={space.rowX} paddingTop={14} paddingBottom={10} justifyContent='space-between' alignItems='flex-end'>
        <YStack gap={3}>
          <UiText fontSize={14} fontWeight='500' color={c.ink2}>Earnings</UiText>
          <UiText fontSize={12} color={c.muted}>{PERIOD_LABEL[filter]}</UiText>
        </YStack>
        {isLoading ? (
          <Skeleton width={80} height={22} />
        ) : (
          <Mono fontSize={18} color={periodEarnings > 0 ? c.positive : c.ink}>
            {periodEarnings > 0 ? "+" : ""}
            {fmtEarningsStat(periodEarnings)}
          </Mono>
        )}
      </XStack>

      {failed ? (
        <UiText fontSize={13} color={c.muted} paddingHorizontal={space.rowX} paddingVertical={24}>
          Couldn’t load your earnings history — it retries automatically.
        </UiText>
      ) : empty ? (
        <UiText fontSize={13} color={c.muted} paddingHorizontal={space.rowX} paddingVertical={24} lineHeight={18}>
          Your earnings curve appears here after your first deposit.
        </UiText>
      ) : isLoading || data.length < 2 ? (
        <YStack paddingHorizontal={space.rowX}>
          <Skeleton width={plotWidth} height={height} />
        </YStack>
      ) : (
        <LineChart
          data={data}
          width={plotWidth}
          height={height}
          color={c.positive}
          thickness={2}
          curved
          hideDataPoints
          areaChart
          startFillColor={c.positive}
          startOpacity={0.12}
          endFillColor={c.surface}
          endOpacity={0}
          initialSpacing={0}
          endSpacing={0}
          spacing={plotWidth / Math.max(1, data.length - 1)}
          disableScroll
          adjustToWidth
          yAxisOffset={yMin}
          maxValue={yMax - yMin}
          noOfSections={SECTIONS}
          yAxisLabelTexts={yLabels}
          yAxisSide={yAxisSides.RIGHT}
          yAxisLabelWidth={Y_LABEL_WIDTH}
          yAxisTextStyle={{ color: c.faint, fontSize: 10, fontFamily: "GeistMono-Regular" }}
          yAxisLabelContainerStyle={{ paddingLeft: 8 }}
          yAxisThickness={0}
          rulesType='dashed'
          rulesColor={c.divider}
          rulesThickness={1}
          dashWidth={4}
          dashGap={4}
          xAxisThickness={0}
          xAxisLabelsHeight={18}
          xAxisLabelsVerticalShift={4}
        />
      )}

      <XStack gap={4} paddingHorizontal={space.rowX} paddingTop={8} justifyContent='center'>
        {TIME_FILTERS.map((f) => {
          const selected = filter === f;
          return (
            <XStack
              key={f}
              onPress={() => setFilter(f)}
              paddingHorizontal={9}
              height={28}
              borderRadius={radius.pill}
              alignItems='center'
              backgroundColor={selected ? c.ink : "transparent"}
              pressStyle={{ backgroundColor: selected ? c.ctaPressed : c.pressTint }}
              accessibilityRole='button'
              accessibilityState={{ selected }}
            >
              <UiText fontSize={12} fontWeight='600' color={selected ? c.ctaText : c.muted}>{f}</UiText>
            </XStack>
          );
        })}
      </XStack>
    </YStack>
  );
};
