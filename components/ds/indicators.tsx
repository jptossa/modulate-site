import type { ReactNode } from "react";
import {
  TREND_ICONS,
  TrendIcon,
  clamp01,
  cx,
  overlapLevel,
  route,
  type RouteIndex,
  type Tone,
  type Trend,
} from "./shared";

/* TrendPill */

export interface TrendPillProps {
  trend: Trend;
  children?: ReactNode;
}

export function TrendPill({ trend, children }: TrendPillProps) {
  const t: Trend = TREND_ICONS[trend] ? trend : "Steady";
  return (
    <span className={cx("md-trend", `md-trend-${TREND_ICONS[t].cls}`)}>
      <TrendIcon trend={t} size={12} />
      {children ?? t}
    </span>
  );
}

/* OverlapMeter */

export interface OverlapMeterProps {
  /** 0–1 */
  value: number;
  route?: RouteIndex;
  tone?: Tone;
  label?: string;
  levelLabel?: string;
}

export function OverlapMeter({ value, route: routeIndex = 0, tone = "light", label, levelLabel }: OverlapMeterProps) {
  const v = clamp01(value);
  const inverse = tone === "inverse";
  const color = inverse ? route(routeIndex).inverse : route(routeIndex).light;
  return (
    <span
      className={cx("md-meter", inverse && "md-meter-inverse")}
      role="meter"
      aria-label={label ?? "Skill overlap"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-valuetext={`${levelLabel ?? overlapLevel(v)} skill overlap`}
    >
      <span className="md-meter-fill" style={{ width: `${Math.round(v * 100)}%`, background: color }} />
    </span>
  );
}

/* OverlapRing */

export interface OverlapRingProps {
  /** 0–1 */
  value: number;
  route?: RouteIndex;
  tone?: Tone;
  size?: number;
  showLabel?: boolean;
  levelLabel?: string;
}

export function OverlapRing({
  value,
  route: routeIndex = 0,
  tone = "light",
  size = 88,
  showLabel,
  levelLabel,
}: OverlapRingProps) {
  const v = clamp01(value);
  const inverse = tone === "inverse";
  const color = inverse ? route(routeIndex).inverse : route(routeIndex).light;
  const label = levelLabel ?? overlapLevel(v);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 104 104"
      role="img"
      aria-label={`Skill overlap: ${label}`}
      className={inverse ? "md-ring-inverse" : undefined}
      style={{ flex: "none" }}
    >
      <circle cx={52} cy={52} r={44} fill="none" strokeWidth={12} className="md-ring-track" />
      <circle
        cx={52}
        cy={52}
        r={44}
        fill="none"
        strokeWidth={12}
        strokeLinecap="round"
        className="md-ring-arc"
        strokeDasharray={`${(276.5 * v).toFixed(1)} 277`}
        transform="rotate(-90 52 52)"
        style={{ stroke: color }}
      />
      {showLabel ? (
        <text
          x={52}
          y={57}
          textAnchor="middle"
          style={{
            fill: inverse ? "var(--on-inverse)" : "var(--ink)",
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            fontWeight: 700,
          }}
        >
          {label}
        </text>
      ) : null}
    </svg>
  );
}

/* StatTile */

export interface StatTileProps {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  /** Adds the trend arrow and colours the value. */
  trend?: Trend;
  /** 0–1: adds an overlap meter under the value. */
  meter?: number;
  route?: RouteIndex;
  tone?: Tone;
  className?: string;
}

export function StatTile({ label, value, note, trend, meter, route: routeIndex = 0, tone = "light", className }: StatTileProps) {
  const inverse = tone === "inverse";
  let valueColor: string | undefined;
  if (trend === "Rising") valueColor = inverse ? "var(--blue-on-inverse)" : "var(--blue-ink)";
  else if (trend) valueColor = inverse ? "var(--on-inverse-strong)" : "var(--ink-muted)";
  return (
    <div className={cx("md-stat", inverse ? "md-stat-inverse" : "md-stat-light", className)}>
      <span className="md-stat-label">{label}</span>
      <span className="md-stat-value" style={valueColor ? { color: valueColor } : undefined}>
        {trend && TREND_ICONS[trend] ? <TrendIcon trend={trend} size={22} /> : null}
        {value}
      </span>
      {meter !== undefined ? <OverlapMeter value={meter} route={routeIndex} tone={inverse ? "inverse" : "light"} /> : null}
      {note ? <span className="md-stat-note">{note}</span> : null}
    </div>
  );
}
