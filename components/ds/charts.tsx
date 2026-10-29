import { useId } from "react";
import { InView } from "./InView";
import { RouteKey, route, shapeEl, type RouteIndex } from "./shared";

/* OpeningsChart */

export interface OpeningsChartProps {
  /** Values 0–100 (relative). */
  values: number[];
  route?: RouteIndex;
  /** Destination role, used in the text alternative. */
  title?: string;
  /** Trend in words for the text alternative, e.g. "rising steadily". */
  summary?: string;
  /** How many trailing bars to highlight. Default 3; 0 for none. */
  highlight?: number;
  height?: number;
  label?: string;
  startLabel?: string;
  endLabel?: string;
  /** Prefix for the default text alternative. Use "Illustrative" for example data. */
  kind?: string;
}

export function OpeningsChart({
  values,
  route: routeIndex = 0,
  title,
  summary,
  highlight = 3,
  height,
  label,
  startLabel = "12 months ago",
  endLabel = "Now",
  kind = "Bar chart",
}: OpeningsChartProps) {
  const color = route(routeIndex).light;
  const alt =
    label ??
    `${kind} of openings${title ? ` for ${title}` : ""}${summary ? `: ${summary}` : ""}.${
      highlight ? ` The last ${highlight} periods are highlighted.` : ""
    }`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div className="md-bars" role="img" aria-label={alt} style={height ? { height: `${height}px` } : undefined}>
        {values.map((v, i) => (
          <div
            key={i}
            className="md-bar"
            style={{
              height: `${Math.max(0, Math.min(100, v))}%`,
              background: i >= values.length - highlight ? color : "var(--chart-muted)",
            }}
          />
        ))}
      </div>
      <div className="md-axis">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
      {highlight ? (
        <div className="md-legend">
          <span className="md-legend-item">
            <span className="md-legend-key" style={{ background: color }} />
            {`Last ${highlight} periods`}
          </span>
          <span className="md-legend-item">
            <span className="md-legend-key" style={{ background: "var(--chart-muted)" }} />
            Earlier periods
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* TrendChart */

export interface TrendSeries {
  label: string;
  values: number[];
  summary?: string;
  /** Route identity (colour and marker shape). Defaults to the series' position, so set it when a route is left out. */
  route?: RouteIndex;
}

export interface TrendChartProps {
  /** Up to three series, in route order. Values 0–100 (relative). */
  series: TrendSeries[];
  /** Dashed grey comparison line, e.g. the user's current role. */
  reference?: { label: string; values: number[] };
  selected?: RouteIndex;
  legend?: boolean;
  label?: string;
  startLabel?: string;
  endLabel?: string;
  /** Prefix for the default text alternative. Use "Illustrative" for example data. */
  kind?: string;
  /** Draws each line in once when it first appears. Off by default; reduced motion skips it. */
  animate?: boolean;
}

const SHAPE_NAMES = ["circle", "square", "diamond"];

function points(values: number[]): string {
  const n = Math.max(1, values.length - 1);
  return values
    .map((v, i) => `${(40 + i * (720 / n)).toFixed(1)},${(270 - Math.max(0, Math.min(100, v)) * 2.4).toFixed(1)}`)
    .join(" ");
}

/** The same vertices as `points`, as a path. Series are drawn as paths because Firefox ignores `pathLength` on a polyline, which the draw-in animation relies on. */
function pathD(values: number[]): string {
  return `M${points(values).split(" ").join(" L")}`;
}

export function TrendChart({
  series: allSeries,
  reference,
  selected = 0,
  legend = true,
  label,
  startLabel = "12 months ago",
  endLabel = "Now",
  kind = "Line chart",
  animate,
}: TrendChartProps) {
  const id = `md-tc-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const series = allSeries.slice(0, 3);
  const alt =
    label ??
    `${kind}. ` +
      series
        .map((s, i) => {
          const r = s.route ?? i;
          return `Route ${r + 1}, ${s.label} (${SHAPE_NAMES[r]} markers)${s.summary ? `: ${s.summary}` : ""}.`;
        })
        .join(" ") +
      (reference ? ` Dashed gray line: ${reference.label}.` : "");

  return (
    <InView active={!!animate} className={animate ? "md-line-enter" : undefined} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <svg viewBox="0 0 800 300" width="100%" role="img" aria-label={alt} style={{ display: "block" }}>
        <defs>
          {series.map((s, i) => (
            <marker
              key={i}
              id={`${id}-${s.route ?? i}`}
              viewBox="0 0 14 14"
              refX={7}
              refY={7}
              markerWidth={14}
              markerHeight={14}
              markerUnits="userSpaceOnUse"
            >
              {shapeEl(route(s.route ?? i).shape, 7, 7, 9, route(s.route ?? i).light)}
            </marker>
          ))}
        </defs>
        <path d="M40 30 H760 M40 90 H760 M40 150 H760 M40 210 H760" className="md-line-grid" fill="none" />
        <path d="M40 270 H760" className="md-line-base" fill="none" />
        {reference ? (
          <polyline
            points={points(reference.values)}
            fill="none"
            style={{ stroke: "var(--chart-reference)", strokeWidth: 3, strokeDasharray: "6 6", strokeLinecap: "round" }}
          />
        ) : null}
        {series.map((s, i) => {
          const r = s.route ?? i;
          const m = `url(#${id}-${r})`;
          return (
            <path
              key={i}
              d={pathD(s.values)}
              pathLength={1}
              className="md-line-series"
              fill="none"
              markerStart={m}
              markerMid={m}
              markerEnd={m}
              style={{
                stroke: route(r).light,
                strokeWidth: r === selected ? 5 : 2.5,
                strokeLinecap: "round",
                strokeLinejoin: "round",
                transition: "stroke-width .35s",
                ["--i" as string]: r,
              }}
            />
          );
        })}
      </svg>
      <div className="md-axis" style={{ padding: "0 4%" }}>
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
      {legend ? (
        <div className="md-legend">
          {series.map((s, i) => (
            <span key={i} className="md-legend-item" style={{ fontWeight: (s.route ?? i) === selected ? 700 : 500, color: "var(--ink)" }}>
              <RouteKey index={s.route ?? i} color={route(s.route ?? i).light} />
              {s.label}
            </span>
          ))}
          {reference ? (
            <span className="md-legend-item">
              <svg width={28} height={14} viewBox="0 0 28 14" aria-hidden="true">
                <path
                  d="M2 7 H26"
                  style={{ stroke: "var(--chart-reference)", strokeWidth: 3, strokeDasharray: "4 4", strokeLinecap: "round", fill: "none" }}
                />
              </svg>
              {reference.label}
            </span>
          ) : null}
        </div>
      ) : null}
    </InView>
  );
}
