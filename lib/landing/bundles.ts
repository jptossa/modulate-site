import "server-only";
import { cacheLife } from "next/cache";
import type { Trend } from "@/components/ds";
import { adjacentRoutes, occupationSeries, skillGap } from "@/lib/market/queries";
import { MIN_YEARS, commonYears, indexAndScale, shareOfPeak, shortTitle, within, type AxisTick } from "@/lib/market/series";
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

/** Candidates fetched per origin; the first three with a usable history become the charted routes, the next few the "more routes" list. */
const CANDIDATES = 10;
/** Most extra routes listed under "Show more routes". */
const MORE_ROUTES = 5;

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

/** A route past the three charted ones: facts only, no chart line or route colour. */
export interface LandingMoreRoute {
  soc: string;
  title: string;
  overlap: number;
  trend: Trend;
  projectedChangePct: number | null;
  medianPay: number | null;
  annualOpenings: number | null;
  have: string[];
  stops: string[];
  /** False when BLS has too few annual estimates to chart this role. */
  hasHistory: boolean;
}

export interface LandingOrigin {
  soc: string;
  label: string;
  routes: LandingRoute[];
  /** Further routes, best first, shown on request. */
  more: LandingMoreRoute[];
  /** First and last year of the shared OEWS window. */
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

  const pickedSocs = new Set(picked.map((c) => c.route.soc));
  const extras = withSeries.filter((c) => !pickedSocs.has(c.route.soc)).slice(0, MORE_ROUTES);

  const originSeries = await occupationSeries(db, soc);
  const years = commonYears(picked.map((c) => c.series));
  if (years.length < MIN_YEARS) return null;

  const raw = picked.map((c) => within(c.series, years));
  const refRaw = years.every((y) => originSeries.some((p) => p.year === y)) ? within(originSeries, years) : null;

  const chart = indexAndScale([...raw, ...(refRaw ? [refRaw] : [])]);

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

  const more = await Promise.all(
    extras.map(async ({ route, series }): Promise<LandingMoreRoute> => {
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
        hasHistory: series.length >= MIN_YEARS,
      };
    }),
  );

  return {
    soc,
    label,
    routes,
    more,
    years: [years[0], years[years.length - 1]],
    lines: chart.lines.slice(0, 3),
    reference: refRaw ? chart.lines[3] : null,
    ticks: chart.ticks,
    changes: chart.changes.slice(0, 3),
    referenceChanges: refRaw ? chart.changes[3] : null,
    bars: raw.map(shareOfPeak),
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
