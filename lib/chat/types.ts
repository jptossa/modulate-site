import type { Trend } from "@/components/ds";

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
}

export interface AdjacentRolesOutput {
  origin: OccupationRef;
  routes: AdjacentRoute[];
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
  skills: string[];
}

export interface SetCurrentRoleOutput {
  currentRole: OccupationRef;
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
