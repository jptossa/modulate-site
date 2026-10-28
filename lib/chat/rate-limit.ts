import "server-only";
import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";

const GUEST_DEFAULT = 20;
const USER_DEFAULT = 200;
const SONNET_DEFAULT = 10;

function limitFrom(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

function hashIp(ip: string): string {
  const salt = process.env.RATE_LIMIT_SALT;
  if (!salt && process.env.NODE_ENV === "production") throw new Error("Missing RATE_LIMIT_SALT.");
  return createHash("sha256").update(`${salt ?? ""}:${ip}`).digest("hex").slice(0, 32);
}

/** Guests are keyed by hashed IP (raw IPs are never stored), signed-in users by id. */
function subjectKey(headers: Headers, userId: string | null): string {
  return userId ? `u:${userId}` : `ip:${hashIp(clientIp(headers))}`;
}

/**
 * Count one use against a daily budget. Fails closed: if the counter cannot be reached the use is refused,
 * so an outage cannot become unlimited model spend.
 */
async function bump(key: string, limit: number): Promise<boolean> {
  try {
    const { data, error } = await createServiceClient().rpc("bump_rate_limit", { p_key: key, p_limit: limit });
    return !error && data === true;
  } catch {
    return false;
  }
}

/** Count this chat request. Signed-in users get a higher limit than guests as a cost backstop. */
export async function withinRateLimit(headers: Headers, userId: string | null): Promise<boolean> {
  try {
    const limit = userId ? limitFrom("USER_DAILY_LIMIT", USER_DEFAULT) : limitFrom("GUEST_DAILY_LIMIT", GUEST_DEFAULT);
    return await bump(subjectKey(headers, userId), limit);
  } catch {
    return false;
  }
}

/**
 * Count one escalation to the stronger model. Same per-person subject as the request limit, in a separate
 * bucket (`sonnet:` prefix), so it is capped per person per day regardless of how many requests they make.
 */
export async function withinSonnetLimit(headers: Headers, userId: string | null): Promise<boolean> {
  try {
    return await bump(`sonnet:${subjectKey(headers, userId)}`, limitFrom("SONNET_DAILY_LIMIT", SONNET_DEFAULT));
  } catch {
    return false;
  }
}
