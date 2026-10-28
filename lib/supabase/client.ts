import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";

/** Supabase client for Client Components. Runs as the signed-in user (or anon), subject to RLS. */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
