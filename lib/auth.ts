import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  email: string | undefined;
}

/**
 * The signed-in user, verified with the Supabase auth server (not just the cookie). Null for guests.
 * Reads cookies, so call it behind <Suspense>.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email };
}

/** For pages and actions that need an account. */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/auth/sign-in?next=${encodeURIComponent(next)}` : "/auth/sign-in");
  return user;
}

/** Only same-site paths: "/chat" yes; "//evil.com", "https://evil.com" and "/\\evil.com" no. */
export function safeNextPath(value: unknown, fallback = "/chat"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
