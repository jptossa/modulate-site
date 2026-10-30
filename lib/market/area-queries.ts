import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdjacentRolesOutput, AreaKind, AreaRef } from "@/lib/chat/types";
import { comparePay } from "./compare";

/** Local OEWS figures keyed by SOC code. Same client rules as queries.ts: any client, throws on query errors. */
export interface AreaFacts {
  employment: number | null;
  medianPay: number | null;
  /** True when BLS only says the median is at or above `medianPay` (its $239,200 cap). */
  medianPayTopCoded: boolean;
  locationQuotient: number | null;
  asOfYear: number;
}

interface AreaRow {
  area_code: string;
  name: string;
  kind: AreaKind;
}

const toRef = (r: AreaRow): AreaRef => ({ code: r.area_code, name: r.name, kind: r.kind });

/** Fuzzy search over states, metropolitan and nonmetropolitan areas ("Austin", "texas"). */
export async function searchAreas(db: SupabaseClient, query: string, limit = 8): Promise<AreaRef[]> {
  const { data, error } = await db.rpc("search_areas", { q: query, lim: limit });
  if (error) throw new Error(error.message);
  return ((data ?? []) as AreaRow[]).map(toRef);
}

export async function areaRef(db: SupabaseClient, code: string): Promise<AreaRef | null> {
  const { data, error } = await db.from("areas").select("area_code, name, kind").eq("area_code", code).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toRef(data as AreaRow) : null;
}

/** Latest local figures for the given occupations. A role BLS publishes nothing for in this place is absent from the map. */
export async function areaMarket(db: SupabaseClient, areaCode: string, socs: string[]): Promise<Map<string, AreaFacts>> {
  const out = new Map<string, AreaFacts>();
  if (socs.length === 0) return out;
  const { data, error } = await db
    .from("occupation_area_market")
    .select("soc_code, employment, median_pay, median_pay_top_coded, location_quotient, as_of_year")
    .eq("area_code", areaCode)
    .in("soc_code", socs);
  if (error) throw new Error(error.message);
  for (const r of data ?? []) {
    out.set(r.soc_code, {
      employment: r.employment,
      medianPay: r.median_pay,
      medianPayTopCoded: r.median_pay_top_coded,
      locationQuotient: r.location_quotient,
      asOfYear: r.as_of_year,
    });
  }
  return out;
}

/** Adds the place and each route's local figures (with the pay comparison) to an adjacent-roles result. */
export async function withLocalFigures(db: SupabaseClient, result: AdjacentRolesOutput, area: AreaRef): Promise<AdjacentRolesOutput> {
  const local = await areaMarket(db, area.code, result.routes.map((r) => r.soc));
  return {
    ...result,
    area,
    routes: result.routes.map((r) => {
      const l = local.get(r.soc);
      return { ...r, local: l ? { ...l, payVsNational: comparePay(l.medianPay, l.medianPayTopCoded, r.medianPay) } : null };
    }),
  };
}
