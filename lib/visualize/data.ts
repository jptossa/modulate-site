import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cacheLife } from "next/cache";
import type { Trend } from "@/components/ds";
import type { AreaRef, OccupationRef, RouteStatus } from "@/lib/chat/types";
import { areaMarket, type AreaFacts } from "@/lib/market/area-queries";
import { occupationSeries, skillGap } from "@/lib/market/queries";
import { shortTitle, type Series } from "@/lib/market/series";
import { ROUTE_SELECT, toRouteRow, type RouteQueryRow } from "@/lib/routes";
import { createPublicClient } from "@/lib/supabase/server";

/** One saved route with everything the visualizer draws. Null means the data source does not report it. */
export interface RouteVisual {
  id: string;
  status: RouteStatus;
  destination: OccupationRef;
  /** 0..1 skill overlap with the origin; null when either role has no O*NET skill ratings. */
  overlap: number | null;
  trend: Trend | null;
  projectedChangePct: number | null;
  medianPay: number | null;
  annualOpenings: number | null;
  /** The destination's top skills the origin already covers. */
  have: string[];
  /** The destination's top skills still to pick up: the stops on the map. */
  stops: string[];
  /** Annual employment estimates (OEWS) for the destination, oldest first. May be empty. */
  series: Series;
  /** Latest OEWS figures for the destination in the user's area. Null when no area is set or BLS publishes nothing for it there. */
  local: AreaFacts | null;
}

/** The user's saved routes that start from one role, sharing one "you are here". */
export interface OriginGroup {
  origin: OccupationRef;
  /** The origin's own annual history, drawn as the dashed reference line. May be empty. */
  originSeries: Series;
  routes: RouteVisual[];
}

type Db = ReturnType<typeof createPublicClient>;

/** Skill overlap of the origin with every other rated role, plus the origin's own history. Public reference data only. */
async function originFacts(originSoc: string): Promise<{ overlaps: Record<string, number>; series: Series }> {
  "use cache";
  cacheLife("days");

  const db: Db = createPublicClient();
  // The RPC only leaves out the origin itself, so asking for more rows than there are occupations returns every pair.
  const { data, error } = await db.rpc("adjacent_occupations", { origin_soc: originSoc, lim: 1000 });
  if (error) throw new Error("Could not compute skill overlap.");
  const overlaps: Record<string, number> = {};
  for (const r of (data ?? []) as Array<{ soc_code: string; overlap: number }>) overlaps[r.soc_code] = r.overlap;
  return { overlaps, series: await occupationSeries(db, originSoc) };
}

type RouteFacts = Omit<RouteVisual, "id" | "status" | "destination" | "overlap" | "local">;

/** Local OEWS figures for several occupations in one area. The area code is the cache key; nothing here is user-specific. */
async function localFacts(areaCode: string, socs: string[]): Promise<Record<string, AreaFacts>> {
  "use cache";
  cacheLife("days");

  return Object.fromEntries(await areaMarket(createPublicClient(), areaCode, socs));
}

/** Market facts, skill gap and history for one origin to destination pair. Public reference data only. */
async function routeFacts(originSoc: string, destSoc: string): Promise<RouteFacts> {
  "use cache";
  cacheLife("days");

  const db: Db = createPublicClient();
  const [market, gap, series] = await Promise.all([
    db
      .from("occupation_market")
      .select("trend, projected_change_pct, median_pay, annual_openings")
      .eq("soc_code", destSoc)
      .maybeSingle(),
    skillGap(db, originSoc, destSoc),
    occupationSeries(db, destSoc),
  ]);
  if (market.error) throw new Error("Could not read market data.");
  const m = market.data;
  return {
    trend: (m?.trend as Trend | null | undefined) ?? null,
    projectedChangePct: m?.projected_change_pct ?? null,
    medianPay: m?.median_pay ?? null,
    annualOpenings: m?.annual_openings ?? null,
    have: gap.have,
    stops: gap.stops,
    series,
  };
}

/**
 * The signed-in user's saved routes, grouped by origin (the origin with the most routes first), with chart
 * data attached. `db` is the cookie-bound client, so RLS limits the rows; the reference-data lookups are cached
 * per origin and per pair and hold nothing about the user. With an `area`, each route also carries the
 * destination's local figures. Throws on a database error.
 */
export async function getVisualizerData(db: SupabaseClient, userId: string, area: AreaRef | null = null): Promise<OriginGroup[]> {
  const { data, error } = await db
    .from("saved_routes")
    .select(ROUTE_SELECT)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Could not load saved routes.");

  const saved = (data as unknown as RouteQueryRow[]).map(toRouteRow).filter((r) => r.origin.soc && r.destination.soc);

  const byOrigin = new Map<string, typeof saved>();
  for (const r of saved) byOrigin.set(r.origin.soc, [...(byOrigin.get(r.origin.soc) ?? []), r]);

  // Sorted so the same set of destinations always hits the same cache entry.
  const destinations = [...new Set(saved.map((r) => r.destination.soc))].sort();
  const local = area ? await localFacts(area.code, destinations) : {};

  const groups = await Promise.all(
    [...byOrigin.values()].map(async (routes): Promise<OriginGroup> => {
      const origin = routes[0].origin;
      const [facts, perRoute] = await Promise.all([
        originFacts(origin.soc),
        Promise.all(routes.map((r) => routeFacts(origin.soc, r.destination.soc))),
      ]);
      return {
        origin: { soc: origin.soc, title: shortTitle(origin.title) },
        originSeries: facts.series,
        routes: routes.map((r, i) => ({
          id: r.id,
          status: r.status,
          destination: { soc: r.destination.soc, title: shortTitle(r.destination.title) },
          overlap: facts.overlaps[r.destination.soc] ?? null,
          local: local[r.destination.soc] ?? null,
          ...perRoute[i],
        })),
      };
    }),
  );

  // Stable for ties: Map keeps first-seen order, which follows updated_at.
  return groups.sort((a, b) => b.routes.length - a.routes.length);
}
