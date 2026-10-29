import type { OccupationRef, RouteStatus, SavedRouteRow } from "@/lib/chat/types";

/** Embedded select that returns a saved route with its origin and destination titles. */
export const ROUTE_SELECT =
  "id, status, notes, origin:occupations!origin_soc(soc_code, title), destination:occupations!destination_soc(soc_code, title)";

export interface RouteQueryRow {
  id: string;
  status: RouteStatus;
  notes: string | null;
  origin: { soc_code: string; title: string } | null;
  destination: { soc_code: string; title: string } | null;
}

export function toRouteRow(r: RouteQueryRow): SavedRouteRow {
  const ref = (o: RouteQueryRow["origin"]): OccupationRef => ({ soc: o?.soc_code ?? "", title: o?.title ?? "Unknown role" });
  return { id: r.id, origin: ref(r.origin), destination: ref(r.destination), status: r.status, notes: r.notes };
}

export const ROUTE_STATUSES = ["considering", "planning", "in_progress", "completed", "dropped"] as const satisfies readonly RouteStatus[];

export const ROUTE_STATUS_LABELS: Record<RouteStatus, string> = {
  considering: "Considering",
  planning: "Planning",
  in_progress: "In progress",
  completed: "Completed",
  dropped: "Dropped",
};
