"use client";

import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { InView } from "./InView";
import { RouteKey, cx, route, shapeEl, type RouteIndex } from "./shared";

/* Axis labelling shared by both charts */

export interface ChartTick {
  /** Position on the chart's 0-100 plot scale. */
  at: number;
  label: string;
  /** The tick every line starts from; drawn a little stronger. */
  baseline?: boolean;
}

export interface ChartYAxis {
  /** Says what the vertical axis measures, e.g. "Jobs, change since 2019". */
  title: string;
  /** Three to six round values, each on a gridline. */
  ticks: ChartTick[];
}

/** Tick labels in a narrow column beside the plot. `top` turns a tick into the percentage down the plot. */
function YLabels({ ticks, top }: { ticks: ChartTick[]; top: (at: number) => number }) {
  // On narrow screens the plot is short, so with four or more ticks every other label is hidden, counting from the baseline.
  const anchor = Math.max(0, ticks.findIndex((t) => t.baseline));
  const thin = ticks.length >= 4;
  return (
    <div className="md-ylabels" aria-hidden="true">
      {ticks.map((t, i) => (
        <span
          key={i}
          className={cx("md-ylabel", t.baseline && "md-ylabel-base", thin && (i - anchor) % 2 !== 0 && "md-ylabel-alt")}
          style={{ top: `${top(t.at)}%` }}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}

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
  /** Title and tick labels for the vertical axis. */
  yAxis?: ChartYAxis;
  /** One label per bar. Replaces the start and end labels; every other one is hidden on narrow screens. */
  xLabels?: string[];
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
  yAxis,
  xLabels,
}: OpeningsChartProps) {
  const color = route(routeIndex).light;
  const alt =
    label ??
    `${kind} of openings${title ? ` for ${title}` : ""}${summary ? `: ${summary}` : ""}.${
      highlight ? ` The last ${highlight} periods are highlighted.` : ""
    }${yAxis ? ` Vertical axis: ${yAxis.title}.` : ""}${xLabels?.length ? ` Horizontal axis: ${xLabels[0]} to ${xLabels[xLabels.length - 1]}.` : ""}`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {yAxis ? <div className="md-chart-head">{yAxis.title}</div> : null}
      <div className={cx("md-plot", yAxis && "md-plot-y")}>
        {yAxis ? <YLabels ticks={yAxis.ticks} top={(at) => 100 - at} /> : null}
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
      </div>
      {xLabels?.length ? (
        <div className={cx("md-bar-ticks", yAxis && "md-xticks-y")} aria-hidden="true">
          {xLabels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      ) : (
        <div className="md-axis">
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>
      )}
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
  /** Short readout text for each point, e.g. "+12%". Shown in the legend: the last one by default, the picked year's on hover. */
  points?: string[];
}

export interface TrendChartProps {
  /** Up to three series, in route order. Values 0–100 (relative). */
  series: TrendSeries[];
  /** Dashed grey comparison line, e.g. the user's current role. */
  reference?: { label: string; values: number[]; points?: string[] };
  selected?: RouteIndex;
  legend?: boolean;
  label?: string;
  startLabel?: string;
  endLabel?: string;
  /** Prefix for the default text alternative. Use "Illustrative" for example data. */
  kind?: string;
  /** Draws each line in once when it first appears. Off by default; reduced motion skips it. */
  animate?: boolean;
  /** Title and ticks for the vertical axis. Gridlines are drawn at the ticks. */
  yAxis?: ChartYAxis;
  /**
   * One label per point, shown under it. Replaces the start and end labels; every other one is hidden on
   * narrow screens. With `points` on the series it also turns on the year readout.
   */
  xLabels?: string[];
}

const SHAPE_NAMES = ["circle", "square", "diamond"];

/** The plot's coordinates inside its 800 x 300 viewBox. */
const X0 = 40;
const XW = 720;
const FLOOR = 270;
const PER_UNIT = 2.4;

const xAt = (i: number, n: number) => X0 + i * (XW / Math.max(1, n - 1));
const yAt = (v: number) => FLOOR - Math.max(0, Math.min(100, v)) * PER_UNIT;

function points(values: number[]): string {
  return values.map((v, i) => `${xAt(i, values.length).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");
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
  yAxis,
  xLabels,
}: TrendChartProps) {
  const id = `md-tc-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const series = allSeries.slice(0, 3);
  const n = series[0]?.values.length ?? 0;

  // The year readout needs a label per point and text per point.
  const readout = !!xLabels && xLabels.length === n && n > 1 && series.some((s) => s.points);
  const [picked, setPicked] = useState<number | null>(null);
  const active = readout ? picked : null;
  const shown = active ?? n - 1;

  const pick = (clientX: number, el: HTMLElement) => {
    const box = el.getBoundingClientRect();
    const x = ((clientX - box.left) / box.width) * 800;
    setPicked(Math.max(0, Math.min(n - 1, Math.round((x - X0) / (XW / (n - 1))))));
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const step = (d: number) => setPicked(Math.max(0, Math.min(n - 1, (picked ?? n - 1) + d)));
    if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "Home") setPicked(0);
    else if (e.key === "End") setPicked(n - 1);
    else if (e.key === "Escape") setPicked(null);
    else return;
    e.preventDefault();
  };
  const handlers = readout
    ? {
        tabIndex: 0,
        role: "group" as const,
        "aria-label": "Chart readout. Use the left and right arrow keys to move between years.",
        onPointerMove: (e: PointerEvent<HTMLDivElement>) => pick(e.clientX, e.currentTarget),
        onPointerDown: (e: PointerEvent<HTMLDivElement>) => pick(e.clientX, e.currentTarget),
        onPointerLeave: (e: PointerEvent<HTMLDivElement>) => e.pointerType === "mouse" && setPicked(null),
        onKeyDown,
        onBlur: () => setPicked(null),
      }
    : {};

  const valueOf = (s: { points?: string[] } | undefined) => s?.points?.[shown];
  const announce = active === null ? "" : `${xLabels![active]}: ${series.map((s) => `${s.label} ${valueOf(s) ?? ""}`).join(", ")}`;

  const alt =
    label ??
    `${kind}. ` +
      series
        .map((s, i) => {
          const r = s.route ?? i;
          return `Route ${r + 1}, ${s.label} (${SHAPE_NAMES[r]} markers)${s.summary ? `: ${s.summary}` : ""}.`;
        })
        .join(" ") +
      (reference ? ` Dashed gray line: ${reference.label}.` : "") +
      (yAxis ? ` Vertical axis: ${yAxis.title}.` : "") +
      (xLabels?.length ? ` Horizontal axis: ${xLabels[0]} to ${xLabels[xLabels.length - 1]}.` : "");

  return (
    <InView active={!!animate} className={animate ? "md-line-enter" : undefined} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {yAxis ? (
        <div className="md-chart-head">
          <span>{yAxis.title}</span>
          {active !== null ? (
            <span className="md-chart-head-year" aria-hidden="true">
              {xLabels![active]}
              {!legend ? `: ${series.map((s) => valueOf(s)).filter(Boolean).join(", ")}` : ""}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className={cx("md-plot", yAxis && "md-plot-y")}>
        {yAxis ? <YLabels ticks={yAxis.ticks} top={(at) => (yAt(at) / 300) * 100} /> : null}
        <div className="md-plot-main" {...handlers}>
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
            {yAxis ? (
              yAxis.ticks.map((t, i) => (
                <path key={i} d={`M${X0} ${yAt(t.at).toFixed(1)} H${X0 + XW}`} className={t.baseline ? "md-line-zero" : "md-line-grid"} fill="none" />
              ))
            ) : (
              <path d="M40 30 H760 M40 90 H760 M40 150 H760 M40 210 H760" className="md-line-grid" fill="none" />
            )}
            <path d="M40 270 H760" className="md-line-base" fill="none" />
            {active !== null ? <line x1={xAt(active, n)} x2={xAt(active, n)} y1={20} y2={FLOOR} className="md-guide" /> : null}
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
        </div>
      </div>
      {xLabels?.length ? (
        <div className={cx("md-xticks", yAxis && "md-xticks-y")} aria-hidden="true">
          {xLabels.map((l, i) => (
            <span key={i} className={cx("md-xtick", active === i && "md-xtick-active")} style={{ left: `${(xAt(i, xLabels.length) / 800) * 100}%` }}>
              {l}
            </span>
          ))}
        </div>
      ) : (
        <div className="md-axis" style={{ padding: "0 4%" }}>
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>
      )}
      {legend ? (
        <div className="md-legend">
          {series.map((s, i) => (
            <span key={i} className="md-legend-item" style={{ fontWeight: (s.route ?? i) === selected ? 700 : 500, color: "var(--ink)" }}>
              <RouteKey index={s.route ?? i} color={route(s.route ?? i).light} />
              {s.label}
              {valueOf(s) ? <span className="md-legend-value">{valueOf(s)}</span> : null}
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
              {valueOf(reference) ? <span className="md-legend-value">{valueOf(reference)}</span> : null}
            </span>
          ) : null}
        </div>
      ) : null}
      {readout ? (
        <>
          <p className="sr-only" role="status" aria-live="polite">
            {announce}
          </p>
          {/* A table ignores the visually-hidden clipping itself, so the wrapper does the hiding. */}
          <div className="sr-only">
            <table>
              <caption>{yAxis?.title ?? "Values by year"}</caption>
              <thead>
                <tr>
                  <th scope="col">Year</th>
                  {series.map((s, i) => (
                    <th key={i} scope="col">
                      {s.label}
                    </th>
                  ))}
                  {reference ? <th scope="col">{reference.label}</th> : null}
                </tr>
              </thead>
              <tbody>
                {xLabels!.map((l, row) => (
                  <tr key={row}>
                    <th scope="row">{l}</th>
                    {series.map((s, i) => (
                      <td key={i}>{s.points?.[row] ?? ""}</td>
                    ))}
                    {reference ? <td>{reference.points?.[row] ?? ""}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </InView>
  );
}
