import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tool } from "ai";
import { z } from "zod";
import type { Trend } from "@/components/ds";
import { areaMarket, areaRef, searchAreas } from "@/lib/market/area-queries";
import { adjacentRoutes, occupationSeries, occupationTitle, skillGap } from "@/lib/market/queries";
import type {
  AdjacentRolesOutput,
  AreaRef,
  MarketTrendOutput,
  SearchAreasOutput,
  SearchOccupationsOutput,
  SkillGapOutput,
  ToolError,
} from "./types";

const SOC = z
  .string()
  .regex(/^\d{2}-\d{4}$/, "A 6-digit SOC code such as 25-2021")
  .describe("6-digit SOC code, e.g. 25-2021. Get it from search_occupations; never guess one.");

const AREA_CODE = z
  .string()
  .regex(/^[A-Za-z0-9]{1,12}$/)
  .describe("Area code from search_areas; never guess one. Omit to use the user's saved place, if any.");

/** Escape the characters ilike treats as wildcards. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const notFound = (soc: string): ToolError => ({ error: `No occupation with SOC code ${soc} in the data.` });

/**
 * Read-only market tools, available to everyone. They run on the cookie-bound client, so RLS applies;
 * the reference tables are public read.
 */
export function marketTools(db: SupabaseClient, defaultArea: AreaRef | null = null) {
  const titleOf = (soc: string) => occupationTitle(db, soc);

  /** An explicit code wins, then the person's saved place. Null means national only. */
  async function resolveArea(areaCode: string | undefined, nationalOnly: boolean): Promise<AreaRef | null | ToolError> {
    if (nationalOnly) return null;
    if (!areaCode) return defaultArea;
    const area = await areaRef(db, areaCode).catch(() => null);
    return area && area.kind !== "national" ? area : { error: `No place with area code ${areaCode} in the data. Get it from search_areas.` };
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

    search_areas: tool({
      description:
        "Find a state or metropolitan area by name, best match first. Use this to turn a place the user names (\"Austin\", \"Ohio\") into an area code for the other tools. Never guess an area code. Not needed for the user's saved place, which the market tools use on their own.",
      inputSchema: z.object({
        query: z.string().trim().min(2).max(80).describe("Place name, e.g. \"Austin\" or \"Ohio\""),
      }),
      execute: async ({ query }): Promise<SearchAreasOutput | ToolError> => {
        try {
          return { query, results: await searchAreas(db, query) };
        } catch {
          return { error: "Place search failed." };
        }
      },
    }),

    adjacent_roles: tool({
      description:
        "Roles whose skill profile overlaps with the origin role, ranked by overlap, with trend and pay for each. Roles from other occupation families come first, and the origin's own family is left out, so the results are real alternatives. Returns 3 routes by default. When the user has a saved place (or you pass area_code) each route also carries local jobs and pay; trend and openings stay national.",
      inputSchema: z.object({
        origin_soc: SOC,
        limit: z.number().int().min(1).max(5).default(3),
        area_code: AREA_CODE.optional(),
        national_only: z.boolean().default(false).describe("True to skip local figures even when the user has a saved place."),
      }),
      execute: async ({ origin_soc, limit, area_code, national_only }): Promise<AdjacentRolesOutput | ToolError> => {
        const area = await resolveArea(area_code, national_only);
        if (area && "error" in area) return area;
        try {
          const result = await adjacentRoutes(db, origin_soc, limit);
          if (!result) return notFound(origin_soc);
          if (!area) return result;
          const local = await areaMarket(db, area.code, result.routes.map((r) => r.soc));
          return { ...result, area, routes: result.routes.map((r) => ({ ...r, local: local.get(r.soc) ?? null })) };
        } catch {
          return { error: "Could not compute adjacent roles." };
        }
      },
    }),

    market_trend: tool({
      description:
        "Job-market facts for one occupation: BLS projected change, median pay, openings, trend (Rising / Steady / Cooling), and annual employment estimates. Fields can be null when BLS reports the occupation only as part of a group; say so rather than guessing. When the user has a saved place (or you pass area_code) it also returns local jobs, local median pay and concentration versus the U.S. for that place; the other figures stay national, so say which is which. A null local block means BLS publishes no estimate there: say so and do not substitute national numbers. If medianPayTopCoded is true the local median is at least that amount (BLS caps it), so say \"at least\" or \"or more\".",
      inputSchema: z.object({
        soc: SOC,
        area_code: AREA_CODE.optional(),
        national_only: z.boolean().default(false).describe("True to skip local figures even when the user has a saved place."),
      }),
      execute: async ({ soc, area_code, national_only }): Promise<MarketTrendOutput | ToolError> => {
        const occ = await titleOf(soc);
        if (!occ) return notFound(soc);
        const area = await resolveArea(area_code, national_only);
        if (area && "error" in area) return area;
        const local = area ? ((await areaMarket(db, area.code, [soc]).catch(() => null))?.get(soc) ?? null) : undefined;

        const [market, series] = await Promise.all([
          db
            .from("occupation_market")
            .select("employment, annual_openings, projected_change_pct, median_pay, trend, source, as_of")
            .eq("soc_code", soc)
            .maybeSingle(),
          occupationSeries(db, soc),
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
          series,
          ...(area ? { area, local: local ?? null } : {}),
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

        try {
          return { origin, destination, ...(await skillGap(db, origin_soc, dest_soc)) };
        } catch {
          return { error: "Could not compute the skill gap." };
        }
      },
    }),
  };
}
