import "server-only";
import { cacheLife } from "next/cache";
import type { Trend } from "@/components/ds";
import { adjacentRoutes, occupationSeries, skillGap } from "@/lib/market/queries";
import { createPublicClient } from "@/lib/supabase/server";

/** Curated origins for the landing page's role chips. SOC codes are checked against the loaded O*NET data. */
const ORIGINS = [
  { soc: "25-2021", label: "Teacher" },
  { soc: "29-1141", label: "Nurse" },
  { soc: "41-1011", label: "Store manager" },
  { soc: "43-4051", label: "Customer service" },
  { soc: "13-2011", label: "Accountant" },
  { soc: "43-6014", label: "Administrative assistant" },
  { soc: "15-1252", label: "Software developer" },
] as const;

/** Candidates fetched per origin; the first three with a usable history become the routes. */
const CANDIDATES = 8;
const MIN_YEARS = 4;

export interface LandingRoute {
  soc: string;
  title: string;
  overlap: number;
  trend: Trend;
  projectedChangePct: number | null;
  medianPay: number | null;
  annualOpenings: number | null;
  /** Skills the destination asks for that the origin already covers. */
  have: string[];
  /** Skills still to pick up, shown as stops on the map. */
  stops: string[];
}

export interface LandingOrigin {
  soc: string;
  label: string;
  routes: LandingRoute[];
  /** First and last year of the shared OEWS window. */
  years: [number, number];
  /** Employment per route, indexed to the first year and scaled into 0..100 for the line chart. */
  lines: number[][];
  /** The origin's own history on the same scale, when it covers the window. */
  reference: number[] | null;
  /** Employment per route as a share of its own peak (0..100), for the bar chart. */
  bars: number[][];
}

type Series = Array<{ year: number; employment: number }>;

/** Drops O*NET's "Except ..." qualifier: "Sales Representatives of Services, Except Advertising, ..." -> "Sales Representatives of Services". */
const shortTitle = (title: string) => title.split(", Except")[0];

/** Longest run of consecutive years that every series covers. */
function commonYears(all: Series[]): number[] {
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

const within = (series: Series, years: number[]) => years.map((y) => series.find((p) => p.year === y)!.employment);
const round = (n: number) => Math.round(n * 10) / 10;

async function buildOrigin(db: ReturnType<typeof createPublicClient>, soc: string, label: string): Promise<LandingOrigin | null> {
  const adjacent = await adjacentRoutes(db, soc, CANDIDATES);
  if (!adjacent) return null;

  const withSeries = await Promise.all(
    adjacent.routes
      .filter((r) => r.trend !== null)
      .map(async (r) => ({ route: r, series: await occupationSeries(db, r.soc) })),
  );
  const picked = withSeries.filter((c) => c.series.length >= MIN_YEARS).slice(0, 3);
  if (picked.length < 3) return null;

  const originSeries = await occupationSeries(db, soc);
  const years = commonYears(picked.map((c) => c.series));
  if (years.length < MIN_YEARS) return null;

  const raw = picked.map((c) => within(c.series, years));
  const refRaw = years.every((y) => originSeries.some((p) => p.year === y)) ? within(originSeries, years) : null;

  // Compare shape, not size: index every line to its first year, then scale the whole set into the chart's band.
  const indexed = [...raw, ...(refRaw ? [refRaw] : [])].map((v) => v.map((x) => (x / v[0]) * 100));
  const flat = indexed.flat();
  const lo = Math.min(...flat);
  const span = Math.max(...flat) - lo || 1;
  const scaled = indexed.map((v) => v.map((x) => round(12 + ((x - lo) / span) * 76)));

  const routes = await Promise.all(
    picked.map(async ({ route }): Promise<LandingRoute> => {
      const gap = await skillGap(db, soc, route.soc);
      return {
        soc: route.soc,
        title: shortTitle(route.title),
        overlap: route.overlap,
        trend: route.trend as Trend,
        projectedChangePct: route.projectedChangePct,
        medianPay: route.medianPay,
        annualOpenings: route.annualOpenings,
        have: gap.have.slice(0, 4),
        stops: gap.stops.slice(0, 2),
      };
    }),
  );

  return {
    soc,
    label,
    routes,
    years: [years[0], years[years.length - 1]],
    lines: scaled.slice(0, 3),
    reference: refRaw ? scaled[3] : null,
    bars: raw.map((v) => {
      const peak = Math.max(...v);
      return v.map((x) => round((x / peak) * 100));
    }),
  };
}

/**
 * Everything the landing page shows, one bundle per origin chip. Reads only public reference data, so
 * it is cached for days and the page stays static. Origins without three destinations that have a usable
 * history are left out; a database error throws (and is not cached).
 */
export async function getLandingOrigins(): Promise<LandingOrigin[]> {
  "use cache";
  cacheLife("days");

  const db = createPublicClient();
  const built = await Promise.all(ORIGINS.map((o) => buildOrigin(db, o.soc, o.label)));
  const origins = built.filter((o): o is LandingOrigin => o !== null);
  // Errors in the helpers read as "not found", so an empty result means the data is missing or unreachable.
  if (origins.length === 0) throw new Error("No landing origins could be built from the database.");
  return origins;
}
