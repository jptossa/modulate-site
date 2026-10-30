import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { CurrentUser } from "@/lib/auth";
import type { AreaRef } from "@/lib/chat/types";
import { areaRef } from "@/lib/market/area-queries";

/** Guests keep their area here. It is a public BLS area code, not personal data, and is re-validated on every read. */
export const AREA_COOKIE = "modulate_area";

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
