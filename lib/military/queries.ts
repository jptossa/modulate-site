import type { SupabaseClient } from "@supabase/supabase-js";
import type { MilitaryMatch } from "@/lib/chat/types";
import type { MilitaryBranch, MilitaryCategory } from "./labels";

interface OccupationRow {
  id: number;
  branch: MilitaryBranch;
  category: MilitaryCategory;
  code: string;
  title: string;
  active: boolean;
  other_links: string[] | null;
}

/** Attach each code's roles (one query for all of them), in the order O*NET lists them. */
async function withRoles(db: SupabaseClient, rows: OccupationRow[]): Promise<MilitaryMatch[]> {
  if (rows.length === 0) return [];
  const { data, error } = await db
    .from("military_roles")
    .select("military_id, position, occupation:occupations(soc_code, title)")
    .in("military_id", rows.map((r) => r.id))
    .order("position");
  if (error) throw new Error(error.message);
  const roles = new Map<number, MilitaryMatch["roles"]>();
  for (const link of (data ?? []) as unknown as Array<{ military_id: number; occupation: { soc_code: string; title: string } | null }>) {
    if (!link.occupation) continue;
    const list = roles.get(link.military_id) ?? [];
    list.push({ soc: link.occupation.soc_code, title: link.occupation.title });
    roles.set(link.military_id, list);
  }
  return rows.map((r) => ({
    id: r.id,
    branch: r.branch,
    category: r.category,
    code: r.code,
    title: r.title,
    active: r.active,
    roles: roles.get(r.id) ?? [],
    otherLinks: r.other_links ?? [],
  }));
}

/**
 * Military codes matching a code ("68W", "3D0X2") or a title ("combat medic"), best first, with their roles.
 * Codes that differ only by skill level or the like and link to the same roles ("3D032", "3D052") collapse to the first,
 * and so does a Space Force copy of an Air Force code (unless the search is limited to Space Force).
 */
export async function searchMilitary(db: SupabaseClient, query: string, branch?: MilitaryBranch, limit = 8): Promise<MilitaryMatch[]> {
  const { data, error } = await db.rpc("search_military", { q: query, lim: 20, branch_filter: branch ?? null });
  if (error) throw new Error(error.message);
  const matches = await withRoles(db, (data ?? []) as OccupationRow[]);
  const seen = new Set<string>();
  const unique: MilitaryMatch[] = [];
  for (const m of matches) {
    // The source lists Air Force codes again under Space Force with the same roles: show one.
    const key = [m.branch === "space_force" ? "air_force" : m.branch, m.category, m.active, m.roles.map((r) => r.soc).join(","), m.otherLinks.join(",")].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(m);
  }
  return unique.slice(0, limit);
}

/** One code by id, or null when it does not exist. */
export async function militaryById(db: SupabaseClient, id: number): Promise<MilitaryMatch | null> {
  const { data, error } = await db
    .from("military_occupations")
    .select("id, branch, category, code, title, active, other_links")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return (await withRoles(db, [data as OccupationRow]))[0];
}
