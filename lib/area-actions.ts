"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { AREA_COOKIE } from "@/lib/area";
import { getCurrentUser } from "@/lib/auth";
import type { AreaRef } from "@/lib/chat/types";
import { areaRef, searchAreas } from "@/lib/market/area-queries";
import { createClient } from "@/lib/supabase/server";

const areaCode = z.string().regex(/^[A-Za-z0-9]{1,12}$/);

export async function searchAreaOptions(query: string): Promise<{ results: AreaRef[]; error?: string }> {
  const q = z.string().trim().min(2).max(80).safeParse(query);
  if (!q.success) return { results: [], error: "Enter at least two characters." };

  try {
    return { results: await searchAreas(await createClient(), q.data) };
  } catch {
    return { results: [], error: "Place search failed. Try again in a moment." };
  }
}

/** Signed-in users keep their area on the profile; guests keep it in a cookie. Null clears it. */
export async function setArea(code: string | null): Promise<{ error?: string }> {
  const parsed = areaCode.nullable().safeParse(code);
  if (!parsed.success) return { error: "That place code is not valid." };

  const supabase = await createClient();
  if (parsed.data) {
    const area = await areaRef(supabase, parsed.data).catch(() => null);
    if (!area || area.kind === "national") return { error: "We have no data for that place." };
  }

  const user = await getCurrentUser();
  if (user) {
    const { error } = await supabase.from("profiles").update({ area_code: parsed.data }).eq("id", user.id);
    if (error) return { error: "Could not save your place. Try again in a moment." };
  } else {
    const store = await cookies();
    if (parsed.data) {
      store.set(AREA_COOKIE, parsed.data, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    } else {
      store.delete(AREA_COOKIE);
    }
  }

  revalidatePath("/", "layout");
  return {};
}
