// Verbatim port of web lib/savings/earnings-history.ts (#53) plus the chart's
// window helpers from sections/savings/savings-chart.tsx.
//
// The REAL earnings curve. No APY assumption anywhere: the wallet's ACTUAL
// total earnings (currentValue − netDeposited, known exactly) are distributed
// over time in proportion to the balance the user ACTUALLY held
// (piecewise-constant from real deposit/withdraw events). Exact at both ends:
// $0 at the first deposit, the true earnings figure now. The only
// approximation is the in-between attribution — proportional to
// balance × time, the fair split absent per-day share prices.

export interface SavingsHistoryEvent {
  type: "deposit" | "withdraw";
  /** Human USDC units. */
  amount: number;
  /** ms epoch. */
  timestamp: number;
}

export interface ChartPoint {
  t: number;
  v: number;
}

/** Integral of balance dt from the first event to T (piecewise constant). */
function balanceTimeWeight(events: SavingsHistoryEvent[], T: number): number {
  let weight = 0;
  let balance = 0;
  let prevT = events.length ? events[0].timestamp : T;
  for (const e of events) {
    if (e.timestamp > T) break;
    weight += balance * (e.timestamp - prevT);
    balance = e.type === "deposit" ? balance + e.amount : Math.max(0, balance - e.amount);
    prevT = e.timestamp;
  }
  weight += balance * (Math.max(T, prevT) - prevT);
  return weight;
}

export function buildRealEarningsHistory(events: SavingsHistoryEvent[], anchorEarnings: number, now: number, numPoints = 80): ChartPoint[] {
  if (events.length === 0) return [];
  const firstT = events[0].timestamp;
  if (now <= firstT) return [];
  const totalWeight = balanceTimeWeight(events, now);
  const step = (now - firstT) / (numPoints - 1);
  return Array.from({ length: numPoints }, (_, i) => {
    const T = firstT + i * step;
    const share = totalWeight > 0 ? balanceTimeWeight(events, T) / totalWeight : 0;
    return { t: T, v: Math.max(0, anchorEarnings * share) };
  });
}

// ─── Windows (savings-chart.tsx) ─────────────────────────────────────────────

export type TimeFilter = "1W" | "1M" | "3M" | "6M" | "1Y" | "5Y" | "ALL";
export const TIME_FILTERS: TimeFilter[] = ["1W", "1M", "3M", "6M", "1Y", "5Y", "ALL"];
const DAY = 24 * 60 * 60 * 1000;
export const WINDOW_MS: Record<TimeFilter, number | null> = {
  "1W": 7 * DAY,
  "1M": 30 * DAY,
  "3M": 90 * DAY,
  "6M": 180 * DAY,
  "1Y": 365 * DAY,
  "5Y": 5 * 365 * DAY,
  ALL: null
};
export const PERIOD_LABEL: Record<TimeFilter, string> = {
  "1W": "7 days",
  "1M": "30 days",
  "3M": "90 days",
  "6M": "6 months",
  "1Y": "1 year",
  "5Y": "5 years",
  ALL: "All time"
};

export function filterByWindow(points: ChartPoint[], filter: TimeFilter, now: number): ChartPoint[] {
  const windowMs = WINDOW_MS[filter];
  if (!windowMs || points.length === 0) return points;
  const cutoff = now - windowMs;
  const after = points.filter((p) => p.t >= cutoff);
  const before = points.filter((p) => p.t < cutoff);
  const startV = before.length > 0 ? before[before.length - 1].v : 0;
  if (after.length === 0)
    return [
      { t: cutoff, v: startV },
      { t: now, v: startV }
    ];
  return [{ t: cutoff, v: startV }, ...after];
}

export function getPeriodEarnings(points: ChartPoint[], windowMs: number, now: number): number {
  if (points.length === 0) return 0;
  const atNow = points[points.length - 1].v;
  const cutoff = now - windowMs;
  const before = points.filter((p) => p.t <= cutoff);
  if (before.length === 0) return atNow;
  return Math.max(0, atNow - before[before.length - 1].v);
}

/** Web fmtStat: small yields need more than cents to be visible. */
export function fmtEarningsStat(v: number): string {
  if (v <= 0) return "$0.00";
  if (v >= 100) return `$${v.toFixed(2)}`;
  if (v >= 1) return `$${v.toFixed(4)}`;
  if (v >= 0.00001) return `$${v.toFixed(5)}`;
  return "<$0.00001";
}

/** Web fmtY: axis labels. */
export function fmtEarningsAxis(v: number): string {
  if (v <= 0) return "$0";
  if (v >= 100) return `$${v.toFixed(2)}`;
  if (v >= 1) return `$${v.toFixed(3)}`;
  if (v >= 0.01) return `$${v.toFixed(4)}`;
  if (v >= 0.001) return `$${v.toFixed(5)}`;
  return `$${v.toFixed(6)}`;
}
