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

/**
 * Compare shape, not size: index every line to its first year, then scale the whole set into the chart's
 * 12..88 band so the lines sit inside the plot with room for the markers.
 */
export function indexAndScale(lines: number[][]): number[][] {
  const indexed = lines.map((v) => v.map((x) => (x / v[0]) * 100));
  const flat = indexed.flat();
  const lo = Math.min(...flat);
  const span = Math.max(...flat) - lo || 1;
  return indexed.map((v) => v.map((x) => round(12 + ((x - lo) / span) * 76)));
}

/** Each value as a share of the series' own peak, 0..100, for the bar chart. */
export function shareOfPeak(values: number[]): number[] {
  const peak = Math.max(...values);
  return values.map((x) => round((x / peak) * 100));
}
