import "server-only";
import { cacheLife } from "next/cache";
import type { Trend } from "@/components/ds";
import { adjacentRoutes, occupationSeries, skillGap } from "@/lib/market/queries";
import { MIN_YEARS, commonYears, shortTitle, type Series } from "@/lib/market/series";
import { createPublicClient } from "@/lib/supabase/server";
import type { LandingOrigin, LandingRoute } from "./types";

export type { LandingOrigin, LandingRoute } from "./types";

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

/** Candidates fetched per origin; the first three with a usable history are charted by default, the next few are listed. */
const CANDIDATES = 10;
/** Most routes listed beyond the three charted by default. */
const MORE_ROUTES = 5;
/** Routes charted by default, and the most the design system can draw (it has three route identities). */
const DEFAULT_CHARTED = 3;

async function buildOrigin(db: ReturnType<typeof createPublicClient>, soc: string, label: string): Promise<LandingOrigin | null> {
  const adjacent = await adjacentRoutes(db, soc, CANDIDATES);
  if (!adjacent) return null;

  const withSeries = await Promise.all(
    adjacent.routes
      .filter((r) => r.trend !== null)
      .map(async (r) => ({ route: r, series: await occupationSeries(db, r.soc) })),
  );
  const charted = withSeries.filter((c) => c.series.length >= MIN_YEARS).slice(0, DEFAULT_CHARTED);
  if (charted.length < DEFAULT_CHARTED) return null;
  if (commonYears(charted.map((c) => c.series)).length < MIN_YEARS) return null;

  // The default three first, then the rest in rank order.
  const chartedSocs = new Set(charted.map((c) => c.route.soc));
  const listed = withSeries.filter((c) => !chartedSocs.has(c.route.soc)).slice(0, MORE_ROUTES);

  const routes = await Promise.all(
    [...charted, ...listed].map(async ({ route, series }): Promise<LandingRoute> => {
      const gap = await skillGap(db, soc, route.soc);
      const hasHistory = series.length >= MIN_YEARS;
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
        series: hasHistory ? series : [],
        hasHistory,
      };
    }),
  );

  const originSeries: Series = await occupationSeries(db, soc);

  return {
    soc,
    label,
    routes,
    defaultCharted: charted.map((c) => c.route.soc),
    originSeries,
  };
}

/**
 * Everything the landing page shows, one bundle per origin chip. Reads only public reference data, so
 * it is cached for days and the page stays static. Origins without three destinations that have a usable
 * history are left out; a database error throws (and is not cached). Chart values are worked out in the
 * browser (`chartData`) from each route's raw series, so the person can choose which routes are drawn.
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
