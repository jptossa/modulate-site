"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ROUTE_STATUSES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "../actions-shared";

const id = z.string().uuid();
const status = z.enum(ROUTE_STATUSES);
const notes = z.string().trim().max(2000, "Keep notes under 2,000 characters.");

export async function updateRouteStatus(routeId: string, next: string): Promise<ActionResult> {
  const parsed = z.object({ id, status }).safeParse({ id: routeId, status: next });
  if (!parsed.success) return { error: "That status is not one we recognise." };

  const user = await requireUser("/routes");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_routes")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id");
  if (error) return { error: "Could not update the route. Try again in a moment." };
  if (!data?.length) return { error: "This route no longer exists." };

  revalidatePath("/routes");
  return {};
}

export async function updateRouteNotes(routeId: string, text: string): Promise<ActionResult> {
  const parsed = z.object({ id, notes }).safeParse({ id: routeId, notes: text });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const user = await requireUser("/routes");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_routes")
    .update({ notes: parsed.data.notes || null })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id");
  if (error) return { error: "Could not save your notes. Try again in a moment." };
  if (!data?.length) return { error: "This route no longer exists." };

  revalidatePath("/routes");
  return {};
}

export async function deleteRoute(routeId: string): Promise<ActionResult> {
  const parsed = id.safeParse(routeId);
  if (!parsed.success) return { error: "That route could not be found." };

  const user = await requireUser("/routes");
  const supabase = await createClient();
  const { error } = await supabase.from("saved_routes").delete().eq("id", parsed.data).eq("user_id", user.id);
  if (error) return { error: "Could not remove the route. Try again in a moment." };

  revalidatePath("/routes");
  return {};
}
