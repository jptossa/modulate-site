"use server";

import { z } from "zod";
import type { MilitaryMatch } from "@/lib/chat/types";
import { shortTitle } from "@/lib/market/series";
import { BRANCH_LABEL } from "@/lib/military/labels";
import { militaryById, searchMilitary } from "@/lib/military/queries";
import { createPublicClient } from "@/lib/supabase/server";
import { buildOrigin } from "./bundles";
import type { LandingOrigin } from "./types";

/**
 * Landing page "start from a military code". Reference data only (nothing user-specific, no model call), so both
 * actions are open to guests and use the cookie-free client.
 */
export async function findMilitaryCodes(query: string): Promise<{ results: MilitaryMatch[]; error?: string }> {
  const q = z.string().trim().min(1).max(80).safeParse(query);
  if (!q.success) return { results: [], error: "Enter a code or title, such as 68W or hospital corpsman." };
  try {
    // Only codes with a civilian role can start a route.
    const matches = await searchMilitary(createPublicClient(), q.data);
    return { results: matches.filter((m) => m.roles.length > 0) };
  } catch {
    return { results: [], error: "Military code search is not available right now. Try again in a moment." };
  }
}

/** The landing bundle for one role a military code links to, labelled with the code (for example "Army 68W"). */
export async function militaryLandingOrigin(militaryId: number, soc: string): Promise<{ origin?: LandingOrigin; error?: string }> {
  const parsed = z.object({ id: z.number().int().positive(), soc: z.string().regex(/^\d{2}-\d{4}$/) }).safeParse({ id: militaryId, soc });
  if (!parsed.success) return { error: "That military code or role is not valid." };
  try {
    const db = createPublicClient();
    const match = await militaryById(db, parsed.data.id);
    if (!match?.roles.some((r) => r.soc === parsed.data.soc)) return { error: "That role is not linked to this code." };
    // A code can link to several roles, so the chip names the one chosen: "Navy HM, Medical Records Specialists".
    const role = match.roles.find((r) => r.soc === parsed.data.soc);
    const label = `${BRANCH_LABEL[match.branch]} ${match.code}, ${shortTitle(role?.title ?? "")}`;
    const origin = await buildOrigin(db, parsed.data.soc, label);
    if (!origin) return { error: "There is not enough job-market history to chart routes from that role yet. Try asking in chat." };
    return { origin };
  } catch {
    return { error: "Could not build routes from that code. Try again in a moment." };
  }
}
