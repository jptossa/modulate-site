import { MIN_YEARS, commonYears, indexAndScale, shareOfPeak, within, type AxisTick } from "@/lib/market/series";
import type { LandingOrigin, LandingRoute } from "./types";

/** The design system draws at most three routes (it has three route identities). */
export const MAX_CHARTED = 3;

/** Pure and client-safe: the landing page works these out in the browser so the charted routes can change. */
export interface ChartData {
  /** The charted routes, in route-identity order. */
  routes: LandingRoute[];
  /** First and last year of the window every charted route covers. */
  years: [number, number];
  /** Employment per route, indexed to the first year and scaled into 0..100 for the line chart. */
  lines: number[][];
  /** The origin's own history on the same scale, when it covers the window. */
  reference: number[] | null;
  /** Y-axis ticks for `lines`: round change-since-first-year values and where they sit on the plot scale. */
  ticks: AxisTick[];
  /** Each route's points as short text ("+12%") for the chart readout, and the origin's when it has a reference line. */
  changes: string[][];
  referenceChanges: string[] | null;
  /** Employment per route as a share of its own peak (0..100), for the bar chart. */
  bars: number[][];
}

const find = (origin: LandingOrigin, soc: string) => origin.routes.find((r) => r.soc === soc);

/** Chart values for the given routes. Every route must pass `canChart`; the default set always does. */
export function chartData(origin: LandingOrigin, chartedSocs: string[]): ChartData {
  const routes = chartedSocs.map((soc) => find(origin, soc)).filter((r): r is LandingRoute => r !== undefined);
  const years = commonYears(routes.map((r) => r.series));
  const raw = routes.map((r) => within(r.series, years));
  const refRaw = years.every((y) => origin.originSeries.some((p) => p.year === y)) ? within(origin.originSeries, years) : null;

  const chart = indexAndScale([...raw, ...(refRaw ? [refRaw] : [])]);
  const n = routes.length;
  return {
    routes,
    years: [years[0], years[years.length - 1]],
    lines: chart.lines.slice(0, n),
    reference: refRaw ? chart.lines[n] : null,
    ticks: chart.ticks,
    changes: chart.changes.slice(0, n),
    referenceChanges: refRaw ? chart.changes[n] : null,
    bars: raw.map(shareOfPeak),
  };
}

/** The charted list after putting `soc` on the chart: appended while there is room, otherwise in place of the route at `slot`. */
export function withRoute(charted: string[], soc: string, slot: number): string[] {
  if (charted.length < MAX_CHARTED) return [...charted, soc];
  return charted.map((s, i) => (i === slot ? soc : s));
}

export type CanChart = { ok: true } | { ok: false; reason: string };

/** Whether `soc` can go on the chart (added, or replacing the route at `slot` when the chart is full). */
export function canChart(origin: LandingOrigin, charted: string[], soc: string, slot: number): CanChart {
  const route = find(origin, soc);
  if (!route || !route.hasHistory) return { ok: false, reason: "Not enough annual history to chart" };
  const next = withRoute(charted, soc, slot);
  const shared = commonYears(next.map((s) => find(origin, s)?.series ?? []));
  if (shared.length < MIN_YEARS) return { ok: false, reason: "Too few years in common with the charted routes" };
  return { ok: true };
}
