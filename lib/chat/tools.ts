import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentUser } from "@/lib/auth";
import { accountTools } from "./account-tools";
import { marketTools } from "./market-tools";

/**
 * The toolset is decided on the server from the verified session: guests get the read-only market
 * tools only, signed-in users also get profile and saved-route tools bound to their own id.
 */
export function buildTools(db: SupabaseClient, user: CurrentUser | null) {
  const market = marketTools(db);
  return user ? { ...market, ...accountTools(db, user) } : market;
}
