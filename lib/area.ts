import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cacheLife } from "next/cache";
import { cookies } from "next/headers";
import type { CurrentUser } from "@/lib/auth";
import type { AreaRef } from "@/lib/chat/types";
import { areaRef, searchAreas } from "@/lib/market/area-queries";
import { createPublicClient } from "@/lib/supabase/server";

/** Guests keep their area here. It is a public BLS area code, not personal data, and is re-validated on every read. */
export const AREA_COOKIE = "modulate_area";

/** Searches for the one-click place chips. Names and nicknames are resolved through `search_areas`, so no BLS codes are hard-coded. */
const POPULAR_QUERIES = ["nyc", "los angeles", "chicago", "dfw", "houston", "atlanta", "bay area", "seattle", "boston", "washington arlington alexandria"];

/** Big metros for the picker's shortcut chips. Public reference data, so it is cached; places that do not resolve are left out. */
export async function getPopularAreas(): Promise<AreaRef[]> {
  "use cache";
  cacheLife("days");

  const db = createPublicClient();
  const found = await Promise.all(POPULAR_QUERIES.map((q) => searchAreas(db, q, 1).then((r) => r[0] ?? null).catch(() => null)));
  const seen = new Set<string>();
  return found.filter((a): a is AreaRef => a !== null && !seen.has(a.code) && seen.add(a.code) !== undefined);
}

/**
 * The area to show local market data for: the profile's for a signed-in user, else the guest's cookie.
 * Null when none is set or the stored code no longer exists. Reads cookies, so call it behind <Suspense>
 * (after `await connection()`), never from a layout.
 */
export async function getPreferredArea(db: SupabaseClient, user: CurrentUser | null): Promise<AreaRef | null> {
  let code: string | null = null;
  if (user) {
    const { data } = await db.from("profiles").select("area_code").eq("id", user.id).maybeSingle();
    code = data?.area_code ?? null;
  } else {
    code = (await cookies()).get(AREA_COOKIE)?.value ?? null;
  }
  if (!code || !/^[A-Za-z0-9]{1,12}$/.test(code)) return null;
  return areaRef(db, code);
}
