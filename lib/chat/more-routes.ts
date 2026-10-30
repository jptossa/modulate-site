"use server";

import { z } from "zod";
import { areaRef, withLocalFigures } from "@/lib/market/area-queries";
import { adjacentRoutes } from "@/lib/market/queries";
import { createClient } from "@/lib/supabase/server";
import type { AdjacentRolesOutput, ToolError } from "./types";

const socCode = z.string().regex(/^\d{2}-\d{4}$/);
const areaCode = z.string().regex(/^[A-Za-z0-9]{1,12}$/).nullable();

/** How many routes "Show more routes" asks for, counting the ones already on the card. */
const MORE_LIMIT = 8;

/**
 * The longer list behind a route card's "Show more routes". Reference data only (no model call, nothing
 * user-specific), so it is open to guests. `area` is the place the card was drawn for, so local figures match.
 */
export async function moreAdjacentRoutes(originSoc: string, area: string | null): Promise<AdjacentRolesOutput | ToolError> {
  const soc = socCode.safeParse(originSoc);
  const code = areaCode.safeParse(area);
  if (!soc.success || !code.success) return { error: "That role or place is not valid." };

  try {
    const db = await createClient();
    const result = await adjacentRoutes(db, soc.data, MORE_LIMIT);
    if (!result) return { error: "That role is not in the data." };
    const place = code.data ? await areaRef(db, code.data) : null;
    return place && place.kind !== "national" ? await withLocalFigures(db, result, place) : result;
  } catch {
    return { error: "Could not load more routes. Try again in a moment." };
  }
}
