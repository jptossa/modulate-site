export const NOT_REPORTED = "Not reported";

export function formatPay(n: number | null): string {
  return n === null ? NOT_REPORTED : `$${Math.round(n).toLocaleString("en-US")}`;
}

export function formatCount(n: number | null): string {
  return n === null ? NOT_REPORTED : Math.round(n).toLocaleString("en-US");
}

/** "+12%" / "-3%" / "0%". */
export function formatChange(pct: number | null): string | null {
  if (pct === null) return null;
  const r = Math.round(pct * 10) / 10;
  return `${r > 0 ? "+" : ""}${r}%`;
}
