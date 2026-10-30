import type { Trend } from "@/components/ds";
import type { PayComparison } from "@/lib/market/compare";

/**
 * Shapes the chat tools return. Shared by the server tools and the client cards so the two stay in step.
 * Tools never throw for expected problems (unknown SOC code, duplicate route); they return `{ error }`
 * so the model can explain it and the card can show it.
 */
export interface ToolError {
  error: string;
}

export interface OccupationRef {
  soc: string;
  title: string;
}

export type AreaKind = "national" | "state" | "metro" | "nonmetro";

/** A place OEWS publishes estimates for. `code` is BLS's own area code; the model never invents one. */
export interface AreaRef {
  code: string;
  name: string;
  kind: AreaKind;
}

export interface SearchAreasOutput {
  query: string;
  results: AreaRef[];
}

/** Local OEWS figures for one occupation. A null field is a figure BLS suppressed or does not publish for the place. */
export interface LocalMarket {
  employment: number | null;
  medianPay: number | null;
  /** True when BLS only says the median is at or above `medianPay` (its $239,200 cap): say "or more". */
  medianPayTopCoded: boolean;
  /** Local share of employment divided by the national share: 1.4 means 40% more concentrated than the U.S. */
  locationQuotient: number | null;
  asOfYear: number;
  /** Local median pay against the national median (same May 2025 survey). Null when either figure is missing. */
  payVsNational?: PayComparison | null;
}

export interface SearchOccupationsOutput {
  query: string;
  results: OccupationRef[];
}

export interface AdjacentRoute extends OccupationRef {
  /** 0..1 skill overlap with the origin. */
  overlap: number;
  overlapLevel: "Very high" | "High" | "Good" | "Moderate";
  trend: Trend | null;
  projectedChangePct: number | null;
  medianPay: number | null;
  annualOpenings: number | null;
  /** Present only when `area` is set on the output; null when BLS publishes nothing for the role there. */
  local?: LocalMarket | null;
}

export interface AdjacentRolesOutput {
  origin: OccupationRef;
  routes: AdjacentRoute[];
  /** The place the `local` figures on each route are for. Absent for national results. */
  area?: AreaRef;
}

export interface MarketTrendOutput extends OccupationRef {
  market: {
    employment: number | null;
    annualOpenings: number | null;
    projectedChangePct: number | null;
    medianPay: number | null;
    trend: Trend | null;
    source: string;
    asOf: string;
  } | null;
  /** Annual employment estimates (OEWS), oldest first. May be empty. */
  series: Array<{ year: number; employment: number }>;
  /** The place `local` is for. Absent for national results. */
  area?: AreaRef;
  /** Local OEWS figures; null when BLS publishes nothing for this role in `area`. Everything else here is national. */
  local?: LocalMarket | null;
}

export interface SkillGapOutput {
  origin: OccupationRef;
  destination: OccupationRef;
  have: string[];
  stops: string[];
}

export interface ProfileOutput {
  displayName: string | null;
  currentRole: OccupationRef | null;
  area: AreaRef | null;
  skills: string[];
}

export interface SetCurrentRoleOutput {
  currentRole: OccupationRef;
}

export interface SetAreaOutput {
  area: AreaRef;
}

export interface AddSkillOutput {
  skill: string;
  alreadyAdded: boolean;
}

export type RouteStatus = "considering" | "planning" | "in_progress" | "completed" | "dropped";

export interface SavedRouteRow {
  id: string;
  origin: OccupationRef;
  destination: OccupationRef;
  status: RouteStatus;
  notes: string | null;
}

export interface ListRoutesOutput {
  routes: SavedRouteRow[];
}

export interface SaveRouteOutput {
  route: SavedRouteRow;
  alreadySaved: boolean;
}

export interface UpdateRouteStatusOutput {
  route: SavedRouteRow;
}

export interface EscalateOutput {
  escalated: boolean;
  /** Shown to the model, not the user. */
  note?: string;
}

export function isToolError(output: unknown): output is ToolError {
  return typeof output === "object" && output !== null && "error" in output && typeof (output as ToolError).error === "string";
}
