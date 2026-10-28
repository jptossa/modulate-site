import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tool } from "ai";
import { z } from "zod";
import { overlapLevel, type Trend } from "@/components/ds";
import type {
  AdjacentRolesOutput,
  MarketTrendOutput,
  SearchOccupationsOutput,
  SkillGapOutput,
  ToolError,
} from "./types";

const SOC = z
  .string()
  .regex(/^\d{2}-\d{4}$/, "A 6-digit SOC code such as 25-2021")
  .describe("6-digit SOC code, e.g. 25-2021. Get it from search_occupations; never guess one.");

/** First four characters of a SOC code: the minor group, e.g. "25-2" (K-12 teachers). */
const minorGroup = (soc: string) => soc.slice(0, 4);
/** First two digits: the major group, e.g. "25" (all education and library roles). */
const majorGroup = (soc: string) => soc.slice(0, 2);

/** Escape the characters ilike treats as wildcards. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const notFound = (soc: string): ToolError => ({ error: `No occupation with SOC code ${soc} in the data.` });

/**
 * Read-only market tools, available to everyone. They run on the cookie-bound client, so RLS applies;
 * the reference tables are public read.
 */
export function marketTools(db: SupabaseClient) {
  async function titleOf(soc: string) {
    const { data } = await db.from("occupations").select("soc_code, title").eq("soc_code", soc).maybeSingle();
    return data ? { soc: data.soc_code as string, title: data.title as string } : null;
  }

  return {
    search_occupations: tool({
      description:
        "Find occupations by job title or keywords, best match first. Use this first to turn what the user says (\"high school teacher\") into SOC codes the other tools need. Matching is fuzzy, but titles are O*NET's formal ones (\"secondary school\" rather than \"high school\"), so if nothing fits, retry with the formal wording.",
      inputSchema: z.object({
        query: z.string().trim().min(2).max(80).describe("Job title or keywords, e.g. \"software developer\""),
      }),
      execute: async ({ query }): Promise<SearchOccupationsOutput | ToolError> => {
        const { data, error } = await db.rpc("search_occupations", { q: query, lim: 8 });
        if (!error) {
          const rows = (data ?? []) as Array<{ soc_code: string; title: string }>;
          return { query, results: rows.map((r) => ({ soc: r.soc_code, title: r.title })) };
        }

        // The RPC ships in a migration that is applied by hand; until it is, fall back to plain substring matching.
        const tokens = query.split(/\s+/).filter((t) => t.length > 1).slice(0, 5);
        if (tokens.length === 0) return { error: "Query too short." };
        let q = db.from("occupations").select("soc_code, title");
        for (const t of tokens) q = q.ilike("title", `%${likeEscape(t)}%`);
        const fallback = await q.order("title").limit(8);
        if (fallback.error) return { error: "Occupation search failed." };
        return { query, results: (fallback.data ?? []).map((r) => ({ soc: r.soc_code, title: r.title })) };
      },
    }),

    adjacent_roles: tool({
      description:
        "Roles whose skill profile overlaps with the origin role, ranked by overlap, with trend and pay for each. Roles from other occupation families come first, and the origin's own family is left out, so the results are real alternatives. Returns 3 routes by default.",
      inputSchema: z.object({
        origin_soc: SOC,
        limit: z.number().int().min(1).max(5).default(3),
      }),
      execute: async ({ origin_soc, limit }): Promise<AdjacentRolesOutput | ToolError> => {
        const origin = await titleOf(origin_soc);
        if (!origin) return notFound(origin_soc);

        // Ask for a wide pool: the closest matches are mostly the origin's own family.
        const { data, error } = await db.rpc("adjacent_occupations", { origin_soc, lim: 100 });
        if (error) return { error: "Could not compute adjacent roles." };

        // Real alternatives first: other major groups, best overlap first. Only if there are too few,
        // backfill from the same major group (never the origin's own minor group, e.g. teachers for a teacher).
        const pool = (data ?? []) as Array<{ soc_code: string; title: string; overlap: number }>;
        const rows = [
          ...pool.filter((r) => majorGroup(r.soc_code) !== majorGroup(origin_soc)),
          ...pool.filter((r) => majorGroup(r.soc_code) === majorGroup(origin_soc) && minorGroup(r.soc_code) !== minorGroup(origin_soc)),
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
      },
    }),

    market_trend: tool({
      description:
        "Job-market facts for one occupation: BLS projected change, median pay, openings, trend (Rising / Steady / Cooling), and annual employment estimates. Fields can be null when BLS reports the occupation only as part of a group; say so rather than guessing.",
      inputSchema: z.object({ soc: SOC }),
      execute: async ({ soc }): Promise<MarketTrendOutput | ToolError> => {
        const occ = await titleOf(soc);
        if (!occ) return notFound(soc);

        const [market, series] = await Promise.all([
          db
            .from("occupation_market")
            .select("employment, annual_openings, projected_change_pct, median_pay, trend, source, as_of")
            .eq("soc_code", soc)
            .maybeSingle(),
          db.from("occupation_series").select("year, employment").eq("soc_code", soc).order("year"),
        ]);

        const m = market.data;
        return {
          ...occ,
          market: m
            ? {
                employment: m.employment,
                annualOpenings: m.annual_openings,
                projectedChangePct: m.projected_change_pct,
                medianPay: m.median_pay,
                trend: m.trend as Trend | null,
                source: m.source,
                asOf: m.as_of,
              }
            : null,
          series: (series.data ?? []) as Array<{ year: number; employment: number }>,
        };
      },
    }),

    skill_gap: tool({
      description:
        "Compare an origin role with a destination role: which of the destination's top skills the origin already covers (have) and which are the stops to pick up.",
      inputSchema: z.object({ origin_soc: SOC, dest_soc: SOC }),
      execute: async ({ origin_soc, dest_soc }): Promise<SkillGapOutput | ToolError> => {
        const [origin, destination] = await Promise.all([titleOf(origin_soc), titleOf(dest_soc)]);
        if (!origin) return notFound(origin_soc);
        if (!destination) return notFound(dest_soc);

        const { data, error } = await db.rpc("skill_gap", { origin_soc, dest_soc, lim: 12 });
        if (error) return { error: "Could not compute the skill gap." };

        const rows = (data ?? []) as Array<{ skill: string; has: boolean }>;
        return {
          origin,
          destination,
          have: rows.filter((r) => r.has).map((r) => r.skill),
          stops: rows.filter((r) => !r.has).map((r) => r.skill),
        };
      },
    }),
  };
}
