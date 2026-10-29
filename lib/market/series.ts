/**
 * Pure helpers for turning annual employment estimates into chart-ready values. Shared by the landing
 * bundles (server) and the route visualizer (client), so keep this file free of server-only imports.
 */

export type Series = Array<{ year: number; employment: number }>;

/** Fewest shared years a line chart needs to say anything about direction. */
export const MIN_YEARS = 4;

export const round = (n: number) => Math.round(n * 10) / 10;

/** Drops O*NET's "Except ..." qualifier: "Sales Representatives of Services, Except Advertising, ..." -> "Sales Representatives of Services". */
export const shortTitle = (title: string) => title.split(", Except")[0];

/** Longest run of consecutive years that every series covers. */
export function commonYears(all: Series[]): number[] {
  if (all.length === 0) return [];
  const [first, ...rest] = all.map((s) => new Set(s.map((p) => p.year)));
  const shared = [...first].filter((y) => rest.every((set) => set.has(y))).sort((a, b) => a - b);
  let best: number[] = [];
  let run: number[] = [];
  for (const y of shared) {
    run = run.length && y === run[run.length - 1] + 1 ? [...run, y] : [y];
    if (run.length > best.length) best = run;
  }
  return best;
}

/** Employment for the given years. Every year must exist in the series (use `commonYears` first). */
export const within = (series: Series, years: number[]) => years.map((y) => series.find((p) => p.year === y)!.employment);

/** A y-axis tick: where it sits on the chart's 0-100 plot scale, and what it says. */
export interface AxisTick {
  at: number;
  label: string;
  /** The tick every line starts from (0% change). */
  baseline?: boolean;
}

/** Whole-percent change from an index (100 = the first year): "+12%", "0%", "-8%". */
const changeLabel = (index: number) => {
  const d = Math.round(index - 100);
  return `${d > 0 ? "+" : ""}${d}%`;
};

/** Round steps (in index points) a tick can use. All divide 100, so the 0% baseline is always a tick. */
const TICK_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200];

/**
 * Compare shape, not size: index every line to its first year (100 = that year), then scale the whole set
 * into the chart's 12..88 band so the lines sit inside the plot with room for the markers.
 * Also returns the y ticks that explain the scale (3 to 6 round change values, always including 0%, each
 * with its position on the 0-100 plot scale) and each point as short text ("+12%") for readouts.
 */
export function indexAndScale(lines: number[][]): { lines: number[][]; ticks: AxisTick[]; changes: string[][] } {
  const indexed = lines.map((v) => v.map((x) => (x / v[0]) * 100));
  const flat = indexed.flat();
  const lo = Math.min(...flat);
  const hi = Math.max(...flat);
  const span = hi - lo || 1;
  const at = (index: number) => round(12 + ((index - lo) / span) * 76);

  // The smallest round step that keeps the axis to six ticks or fewer.
  const step = TICK_STEPS.find((s) => Math.floor(hi / s) - Math.ceil(lo / s) + 1 <= 6) ?? TICK_STEPS[TICK_STEPS.length - 1];
  const ticks: AxisTick[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) {
    ticks.push({ at: at(t), label: changeLabel(t), baseline: t === 100 });
  }

  return {
    lines: indexed.map((v) => v.map(at)),
    ticks,
    changes: indexed.map((v) => v.map(changeLabel)),
  };
}

/** Ticks for a chart whose values are a share of the highest year (0..100). */
export const SHARE_OF_PEAK_TICKS: AxisTick[] = [
  { at: 0, label: "0%" },
  { at: 50, label: "50%" },
  { at: 100, label: "100%" },
];

/** "2019", "2020", ... for the first through last year. */
export const yearRange = (first: number, last: number): string[] =>
  Array.from({ length: last - first + 1 }, (_, i) => String(first + i));

/** Each value as a share of the series' own peak, 0..100, for the bar chart. */
export function shareOfPeak(values: number[]): number[] {
  const peak = Math.max(...values);
  return values.map((x) => round((x / peak) * 100));
}
