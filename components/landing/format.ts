export const NOT_REPORTED = "Not reported";

export function formatPay(n: number | null): string {
  return n === null ? NOT_REPORTED : `$${Math.round(n).toLocaleString("en-US")}`;
}

/** "$239,200 or more" for a pay BLS caps (top-coded); otherwise like formatPay. */
export function formatLocalPay(n: number | null, topCoded: boolean): string {
  return n !== null && topCoded ? `${formatPay(n)} or more` : formatPay(n);
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
