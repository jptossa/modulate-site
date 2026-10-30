import { connection } from "next/server";
import { Suspense } from "react";
import { AreaPicker } from "@/components/area/AreaPicker";
import { getPopularAreas, getPreferredArea } from "@/lib/area";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Place picker for the hero, collapsed. The chat reads the saved place (cookie for guests, profile for
 * signed-in users); the charts on this page stay national. The shell is static; the session is read inside <Suspense>.
 */
export function LandingPlace() {
  return (
    <Suspense fallback={null}>
      <PlaceForVisitor />
    </Suspense>
  );
}

async function PlaceForVisitor() {
  // Keep this out of the prerender and the runtime prefetch: the auth check reads the clock.
  await connection();
  const user = await getCurrentUser();
  const area = await getPreferredArea(await createClient(), user).catch(() => null);
  const suggestions = area ? [] : await getPopularAreas().catch(() => []);

  return (
    <details className="lp-place">
      <summary>{area ? `Chat uses local figures for ${area.name}` : "Add your place for local pay and job counts in chat"}</summary>
      <AreaPicker current={area} id="lp-area" suggestions={suggestions} />
    </details>
  );
}
