"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import type { OccupationRef } from "@/lib/chat/types";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "../actions-shared";

const UNIQUE_VIOLATION = "23505";

const displayName = z.string().trim().max(80, "Keep your name under 80 characters.");
const soc = z.string().regex(/^\d{2}-\d{4}$/);
const skillName = z.string().trim().min(1, "Enter a skill.").max(120, "Keep skill names under 120 characters.");

/** Escape the characters ilike treats as wildcards. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function updateDisplayName(name: string): Promise<ActionResult> {
  const parsed = displayName.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const user = await requireUser("/profile");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ display_name: parsed.data || null }).eq("id", user.id);
  if (error) return { error: "Could not save your name. Try again in a moment." };

  revalidatePath("/profile");
  return {};
}

export async function searchRoles(query: string): Promise<{ results: OccupationRef[]; error?: string }> {
  const q = z.string().trim().min(2).max(80).safeParse(query);
  if (!q.success) return { results: [], error: "Enter at least two characters." };

  await requireUser("/profile");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_occupations", { q: q.data, lim: 8 });
  if (!error) {
    const rows = (data ?? []) as Array<{ soc_code: string; title: string }>;
    return { results: rows.map((r) => ({ soc: r.soc_code, title: r.title })) };
  }

  // Same fallback as the chat tool: the RPC ships in a migration that is applied by hand.
  const tokens = q.data.split(/\s+/).filter((t) => t.length > 1).slice(0, 5);
  let fallback = supabase.from("occupations").select("soc_code, title");
  for (const t of tokens) fallback = fallback.ilike("title", `%${likeEscape(t)}%`);
  const { data: rows, error: fallbackError } = await fallback.order("title").limit(8);
  if (fallbackError) return { results: [], error: "Role search failed. Try again in a moment." };
  return { results: (rows ?? []).map((r) => ({ soc: r.soc_code, title: r.title })) };
}

export async function setCurrentRole(code: string | null): Promise<ActionResult> {
  const parsed = soc.nullable().safeParse(code);
  if (!parsed.success) return { error: "That role code is not valid." };

  const user = await requireUser("/profile");
  const supabase = await createClient();
  if (parsed.data) {
    const { data: occ } = await supabase.from("occupations").select("soc_code").eq("soc_code", parsed.data).maybeSingle();
    if (!occ) return { error: "We have no data for that role." };
  }
  const { error } = await supabase.from("profiles").update({ current_soc: parsed.data }).eq("id", user.id);
  if (error) return { error: "Could not save your current role. Try again in a moment." };

  revalidatePath("/profile");
  return {};
}

export async function addSkill(name: string): Promise<ActionResult> {
  const parsed = skillName.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const user = await requireUser("/profile");
  const supabase = await createClient();
  const { data: known } = await supabase.from("skills").select("id, name").ilike("name", likeEscape(parsed.data)).limit(1);
  const match = known?.[0];
  const row: { user_id: string; skill_id?: number; free_text?: string } = match
    ? { user_id: user.id, skill_id: match.id }
    : { user_id: user.id, free_text: parsed.data };

  const { error } = await supabase.from("user_skills").insert(row);
  if (error?.code === UNIQUE_VIOLATION) return { error: "You have already added that skill." };
  if (error) return { error: "Could not add the skill. Try again in a moment." };

  revalidatePath("/profile");
  return {};
}

export async function removeSkill(skillRowId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(skillRowId);
  if (!parsed.success) return { error: "That skill could not be found." };

  const user = await requireUser("/profile");
  const supabase = await createClient();
  const { error } = await supabase.from("user_skills").delete().eq("id", parsed.data).eq("user_id", user.id);
  if (error) return { error: "Could not remove the skill. Try again in a moment." };

  revalidatePath("/profile");
  return {};
}
