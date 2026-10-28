import Link from "next/link";

/** The mark plus the lowercase wordmark, as the design system specifies: mark, 10px gap, Instrument Sans 700, ~23px, ink. */
export function Logo() {
  return (
    <Link href="/" aria-label="Modulate home" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size SVG, nothing to optimise */}
      <img src="/modulate-mark.svg" width={36} height={36} alt="" />
      <span style={{ fontWeight: 700, fontSize: 23, letterSpacing: "-0.02em", color: "var(--ink)" }}>modulate</span>
    </Link>
  );
}
