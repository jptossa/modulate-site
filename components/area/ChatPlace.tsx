import { connection } from "next/server";
import { getPopularAreas, getPreferredArea } from "@/lib/area";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AreaPicker } from "./AreaPicker";

/**
 * The place picker above the chat thread, collapsed so it stays out of the way. Guests keep the place in a
 * cookie, signed-in users on their profile; the chat route reads either on every message. Reads the session,
 * so render it inside <Suspense>.
 */
export async function ChatPlace() {
  await connection();
  const user = await getCurrentUser();
  const area = await getPreferredArea(await createClient(), user).catch(() => null);
  const suggestions = area ? [] : await getPopularAreas().catch(() => []);

  return (
    <details className="chat-place">
      <summary>{area ? `Local figures for ${area.name}` : "Add your place for local pay and job counts"}</summary>
      <AreaPicker current={area} id="chat-area" suggestions={suggestions} />
    </details>
  );
}
