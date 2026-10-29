import type { SupabaseClient } from "@supabase/supabase-js";
import { overlapLevel, type Trend } from "@/components/ds";
import type { AdjacentRolesOutput, OccupationRef } from "@/lib/chat/types";

/**
 * Reference-data queries shared by the chat tools and the landing page. They take any Supabase client
 * (the reference tables are public read) and throw on database errors; callers decide how to report them.
 */

/** First four characters of a SOC code: the minor group, e.g. "25-2" (K-12 teachers). */
const minorGroup = (soc: string) => soc.slice(0, 4);
/** First two digits: the major group, e.g. "25" (all education and library roles). */
const majorGroup = (soc: string) => soc.slice(0, 2);

export async function occupationTitle(db: SupabaseClient, soc: string): Promise<OccupationRef | null> {
  const { data } = await db.from("occupations").select("soc_code, title").eq("soc_code", soc).maybeSingle();
  return data ? { soc: data.soc_code as string, title: data.title as string } : null;
}

/**
 * Roles whose skill profile overlaps with the origin, best first, with market facts. Roles from other
 * major groups come first and the origin's own minor group is always left out, so the results are real
 * alternatives. Returns null when the origin is not in the data.
 */
export async function adjacentRoutes(db: SupabaseClient, originSoc: string, limit: number): Promise<AdjacentRolesOutput | null> {
  const origin = await occupationTitle(db, originSoc);
  if (!origin) return null;

  // Ask for a wide pool: the closest matches are mostly the origin's own family.
  const { data, error } = await db.rpc("adjacent_occupations", { origin_soc: originSoc, lim: 100 });
  if (error) throw new Error("Could not compute adjacent roles.");

  const pool = (data ?? []) as Array<{ soc_code: string; title: string; overlap: number }>;
  const rows = [
    ...pool.filter((r) => majorGroup(r.soc_code) !== majorGroup(originSoc)),
    ...pool.filter((r) => majorGroup(r.soc_code) === majorGroup(originSoc) && minorGroup(r.soc_code) !== minorGroup(originSoc)),
  ].slice(0, limit);

  const { data: market } = rows.length
    ? await db
        .from("occupation_market")
        .select("soc_code, trend, projected_change_pct, median_pay, annual_openings")
        .in("soc_code", rows.map((r) => r.soc_code))
    : { data: [] };
  const bySoc = new Map((market ?? []).map((m) => [m.soc_code as string, m]));

  return {
    origin,
    routes: rows.map((r) => {
      const m = bySoc.get(r.soc_code);
      return {
        soc: r.soc_code,
        title: r.title,
        overlap: r.overlap,
        overlapLevel: overlapLevel(r.overlap),
        trend: (m?.trend as Trend | null | undefined) ?? null,
        projectedChangePct: m?.projected_change_pct ?? null,
        medianPay: m?.median_pay ?? null,
        annualOpenings: m?.annual_openings ?? null,
      };
    }),
  };
}

/** Annual employment estimates (OEWS), oldest first. May be empty. */
export async function occupationSeries(db: SupabaseClient, soc: string): Promise<Array<{ year: number; employment: number }>> {
  const { data } = await db.from("occupation_series").select("year, employment").eq("soc_code", soc).order("year");
  return (data ?? []) as Array<{ year: number; employment: number }>;
}

/** The destination's top skills split into those the origin already has and the stops still to pick up. */
export async function skillGap(db: SupabaseClient, originSoc: string, destSoc: string, lim = 12) {
  const { data, error } = await db.rpc("skill_gap", { origin_soc: originSoc, dest_soc: destSoc, lim });
  if (error) throw new Error("Could not compute the skill gap.");
  const rows = (data ?? []) as Array<{ skill: string; has: boolean }>;
  return {
    have: rows.filter((r) => r.has).map((r) => r.skill),
    stops: rows.filter((r) => !r.has).map((r) => r.skill),
  };
}
