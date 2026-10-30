/**
 * Local median pay against the national median. Both are the May 2025 BLS OEWS median for the same occupation
 * (the national figure in occupation_market is the OEWS median too), so the comparison is like for like.
 * Pure and client-safe.
 */
export interface PayComparison {
  /** Whole-number percent difference, positive when local pay is higher. */
  pct: number;
  /** BLS only says the local median is at or above its pay cap, so the real gap is at least this much. */
  atLeast: boolean;
}

/** Within this many percent either way, a gap is called "about the same" rather than reported. */
export const SAME_PAY_PCT = 3;

export function comparePay(localPay: number | null, localTopCoded: boolean, nationalPay: number | null): PayComparison | null {
  if (localPay === null || nationalPay === null || nationalPay <= 0) return null;
  return { pct: Math.round((localPay / nationalPay - 1) * 100), atLeast: localTopCoded };
}

/** "12% above the U.S. median", "at least 12% above the U.S. median", "About the U.S. median". */
export function describePayComparison(c: PayComparison): string {
  if (!c.atLeast && Math.abs(c.pct) < SAME_PAY_PCT) return "About the U.S. median";
  const dir = c.pct >= 0 ? "above" : "below";
  return `${c.atLeast ? "At least " : ""}${Math.abs(c.pct)}% ${dir} the U.S. median`;
}
