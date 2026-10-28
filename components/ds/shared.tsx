import type { ReactElement } from "react";

export type RouteIndex = 0 | 1 | 2;
export type Trend = "Rising" | "Steady" | "Cooling";
export type Tone = "light" | "inverse";
export type Shape = "circle" | "square" | "diamond";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

/** Overlap level word. Thresholds match the design system's bundle. */
export function overlapLevel(v: number): "Very high" | "High" | "Good" | "Moderate" {
  return v >= 0.85 ? "Very high" : v >= 0.75 ? "High" : v >= 0.65 ? "Good" : "Moderate";
}

/**
 * Route identities, in order: route 1 blue/circle, route 2 ink/square, route 3 coral/diamond.
 * Colour is always paired with the marker shape.
 */
export const ROUTES: ReadonlyArray<{
  light: string;
  inverse: string;
  inverseText: string;
  shape: Shape;
}> = [
  { light: "var(--blue)", inverse: "var(--blue-light)", inverseText: "var(--blue-on-inverse)", shape: "circle" },
  { light: "var(--ink)", inverse: "var(--on-inverse)", inverseText: "var(--on-inverse)", shape: "square" },
  { light: "var(--coral-strong)", inverse: "var(--coral)", inverseText: "var(--coral-on-inverse)", shape: "diamond" },
];

export function route(i: number | undefined) {
  return ROUTES[i ?? 0] ?? ROUTES[0];
}

export function shapeEl(shape: Shape, x: number, y: number, size: number, fill: string, key?: string): ReactElement {
  const style = { fill, stroke: "var(--surface-raised)", strokeWidth: 1.5 };
  if (shape === "square") {
    return <rect key={key} x={x - size / 2} y={y - size / 2} width={size} height={size} style={style} />;
  }
  if (shape === "diamond") {
    const r = size * 0.62;
    return <path key={key} d={`M${x} ${y - r} L${x + r} ${y} L${x} ${y + r} L${x - r} ${y} Z`} style={style} />;
  }
  return <circle key={key} cx={x} cy={y} r={size / 2} style={style} />;
}

/** The short line-plus-marker swatch used in legends and route headings. */
export function RouteKey({ index, color }: { index: number; color: string }) {
  return (
    <svg width={28} height={14} viewBox="0 0 28 14" aria-hidden="true" style={{ flex: "none" }}>
      <path d="M2 7 H26" style={{ stroke: color, strokeWidth: 3, strokeLinecap: "round", fill: "none" }} />
      {shapeEl(route(index).shape, 14, 7, 8, color)}
    </svg>
  );
}

export const TREND_ICONS: Record<Trend, { cls: string; icon: string }> = {
  Rising: { cls: "rising", icon: "M2 10 L6 6 L8 8 L12 4 M9 4 H12 V7" },
  Steady: { cls: "steady", icon: "M2 7 H12 M9 4 L12 7 L9 10" },
  Cooling: { cls: "cooling", icon: "M2 4 L6 8 L8 6 L12 10 M9 10 H12 V7" },
};

export function TrendIcon({ trend, size }: { trend: Trend; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" style={{ flex: "none" }}>
      <path
        d={TREND_ICONS[trend].icon}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
