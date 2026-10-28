import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tool } from "ai";
import { z } from "zod";
import type { CurrentUser } from "@/lib/auth";
import type {
  AddSkillOutput,
  ListRoutesOutput,
  OccupationRef,
  ProfileOutput,
  RouteStatus,
  SaveRouteOutput,
  SavedRouteRow,
  SetCurrentRoleOutput,
  ToolError,
  UpdateRouteStatusOutput,
} from "./types";

const SOC = z.string().regex(/^\d{2}-\d{4}$/, "A 6-digit SOC code such as 25-2021").describe("6-digit SOC code from search_occupations");
const STATUSES = ["considering", "planning", "in_progress", "completed", "dropped"] as const;

const UNIQUE_VIOLATION = "23505";

interface RouteQueryRow {
  id: string;
  status: RouteStatus;
  notes: string | null;
  origin: { soc_code: string; title: string } | null;
  destination: { soc_code: string; title: string } | null;
}

const ROUTE_SELECT =
  "id, status, notes, origin:occupations!origin_soc(soc_code, title), destination:occupations!destination_soc(soc_code, title)";

function toRouteRow(r: RouteQueryRow): SavedRouteRow {
  const ref = (o: RouteQueryRow["origin"]): OccupationRef => ({ soc: o?.soc_code ?? "", title: o?.title ?? "Unknown role" });
  return { id: r.id, origin: ref(r.origin), destination: ref(r.destination), status: r.status, notes: r.notes };
}

/**
 * Profile and saved-route tools for signed-in users. `db` is the cookie-bound client, so RLS scopes every
 * query to the caller; `user` is the verified session user. No tool takes a user id from the model: the id
 * comes from the closure, and writes set `user_id` from it.
 */
export function accountTools(db: SupabaseClient, user: CurrentUser) {
  async function fetchRoute(id: string): Promise<SavedRouteRow | null> {
    const { data } = await db.from("saved_routes").select(ROUTE_SELECT).eq("id", id).eq("user_id", user.id).maybeSingle();
    return data ? toRouteRow(data as unknown as RouteQueryRow) : null;
  }

  return {
    get_profile: tool({
      description: "The signed-in user's profile: display name, current role and the skills they have told us about.",
      inputSchema: z.object({}),
      execute: async (): Promise<ProfileOutput | ToolError> => {
        const [profile, skills] = await Promise.all([
          db.from("profiles").select("display_name, current:occupations!current_soc(soc_code, title)").eq("id", user.id).maybeSingle(),
          db.from("user_skills").select("free_text, skill:skills(name)").eq("user_id", user.id).order("created_at"),
        ]);
        if (profile.error || skills.error) return { error: "Could not read the profile." };

        const current = profile.data?.current as unknown as { soc_code: string; title: string } | null | undefined;
        return {
          displayName: profile.data?.display_name ?? null,
          currentRole: current ? { soc: current.soc_code, title: current.title } : null,
          skills: (skills.data ?? []).map((s) => ((s.skill as unknown as { name: string } | null)?.name ?? s.free_text) as string),
        };
      },
    }),

    set_current_role: tool({
      description: "Save the user's current role to their profile. Only call this after the user has said what their current role is.",
      inputSchema: z.object({ soc: SOC }),
      execute: async ({ soc }): Promise<SetCurrentRoleOutput | ToolError> => {
        const { data: occ } = await db.from("occupations").select("soc_code, title").eq("soc_code", soc).maybeSingle();
        if (!occ) return { error: `No occupation with SOC code ${soc} in the data.` };
        const { error } = await db.from("profiles").update({ current_soc: soc }).eq("id", user.id);
        if (error) return { error: "Could not update the profile." };
        return { currentRole: { soc: occ.soc_code, title: occ.title } };
      },
    }),

    add_skill: tool({
      description: "Add a skill the user says they have to their profile. Matches known skills where it can, otherwise stores the user's own wording.",
      inputSchema: z.object({ name: z.string().trim().min(1).max(120) }),
      execute: async ({ name }): Promise<AddSkillOutput | ToolError> => {
        const { data: known } = await db.from("skills").select("id, name").ilike("name", name.replace(/[\\%_]/g, (c) => `\\${c}`)).limit(1);
        const match = known?.[0];
        const row: { user_id: string; skill_id?: number; free_text?: string } = match
          ? { user_id: user.id, skill_id: match.id }
          : { user_id: user.id, free_text: name };
        const { error } = await db.from("user_skills").insert(row);
        if (error && error.code !== UNIQUE_VIOLATION) return { error: "Could not add the skill." };
        return { skill: match?.name ?? name, alreadyAdded: error?.code === UNIQUE_VIOLATION };
      },
    }),

    list_routes: tool({
      description: "The routes the user has saved, with status. Call this before saving a route to avoid duplicates, or when the user asks what they have saved.",
      inputSchema: z.object({}),
      execute: async (): Promise<ListRoutesOutput | ToolError> => {
        const { data, error } = await db.from("saved_routes").select(ROUTE_SELECT).eq("user_id", user.id).order("updated_at", { ascending: false });
        if (error) return { error: "Could not read saved routes." };
        return { routes: (data as unknown as RouteQueryRow[]).map(toRouteRow) };
      },
    }),

    save_route: tool({
      description:
        "Save a route from an origin role to a destination role, starting at status 'considering'. Only call after the user has asked to save or track it.",
      inputSchema: z.object({
        origin_soc: SOC,
        destination_soc: SOC,
        notes: z.string().trim().max(2000).optional(),
      }),
      execute: async ({ origin_soc, destination_soc, notes }): Promise<SaveRouteOutput | ToolError> => {
        if (origin_soc === destination_soc) return { error: "Origin and destination must be different roles." };
        const { data, error } = await db
          .from("saved_routes")
          .insert({ user_id: user.id, origin_soc, destination_soc, notes: notes ?? null })
          .select(ROUTE_SELECT)
          .single();

        if (error?.code === UNIQUE_VIOLATION) {
          const { data: existing } = await db
            .from("saved_routes")
            .select(ROUTE_SELECT)
            .eq("user_id", user.id)
            .eq("origin_soc", origin_soc)
            .eq("destination_soc", destination_soc)
            .single();
          return existing
            ? { route: toRouteRow(existing as unknown as RouteQueryRow), alreadySaved: true }
            : { error: "That route is already saved." };
        }
        if (error || !data) return { error: "Could not save the route. Check both SOC codes came from search_occupations." };
        return { route: toRouteRow(data as unknown as RouteQueryRow), alreadySaved: false };
      },
    }),

    update_route_status: tool({
      description: "Change the status of one of the user's saved routes. Get the route id from list_routes.",
      inputSchema: z.object({
        route_id: z.string().uuid(),
        status: z.enum(STATUSES),
      }),
      execute: async ({ route_id, status }): Promise<UpdateRouteStatusOutput | ToolError> => {
        const { data, error } = await db.from("saved_routes").update({ status }).eq("id", route_id).eq("user_id", user.id).select("id");
        if (error) return { error: "Could not update the route." };
        if (!data?.length) return { error: "No saved route with that id." };
        const route = await fetchRoute(route_id);
        return route ? { route } : { error: "Could not read the route back." };
      },
    }),
  };
}
