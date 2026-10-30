import type { Trend } from "@/components/ds";
import type { Series } from "@/lib/market/series";

/** One destination for an origin. Safe to import from client components (no server-only code here). */
export interface LandingRoute {
  soc: string;
  title: string;
  overlap: number;
  trend: Trend;
  projectedChangePct: number | null;
  medianPay: number | null;
  annualOpenings: number | null;
  /** Skills the destination asks for that the origin already covers. */
  have: string[];
  /** Skills still to pick up, shown as stops on the map. */
  stops: string[];
  /** Annual employment estimates (OEWS), oldest first. Empty when BLS has too few years to chart the role. */
  series: Series;
  hasHistory: boolean;
}

export interface LandingOrigin {
  soc: string;
  label: string;
  /** Every route on offer: the default charted three first, then the rest in rank order. */
  routes: LandingRoute[];
  /** SOC codes charted until the person chooses otherwise (three, each with history and years in common). */
  defaultCharted: string[];
  /** The origin's own history, drawn as the dashed reference line when it covers the charted years. */
  originSeries: Series;
}
