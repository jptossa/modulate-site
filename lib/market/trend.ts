export type Trend = "Rising" | "Steady" | "Cooling";

/**
 * Demand trend from BLS projected employment change over 2025–35.
 * All occupations together are projected at +3.5%; across the 831 detailed occupations the median is +2.7%,
 * about 20% are at +6% or more and about 20% at -2% or less. Those two cut points split them that way.
 * Keep this file free of type-only-unsupported syntax: scripts/ingest/bls.mjs imports it directly.
 */
export const RISING_AT_PCT = 6;
export const COOLING_AT_PCT = -2;

export function trendFor(projectedChangePct: number | null | undefined): Trend | null {
  if (projectedChangePct === null || projectedChangePct === undefined || Number.isNaN(projectedChangePct)) return null;
  if (projectedChangePct >= RISING_AT_PCT) return "Rising";
  if (projectedChangePct <= COOLING_AT_PCT) return "Cooling";
  return "Steady";
}
