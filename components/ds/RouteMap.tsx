"use client";

import type { CSSProperties } from "react";
import { cx, route, type RouteIndex } from "./shared";
import { usePrefersReducedMotion } from "./motion";

export interface MapRoute {
  title: string;
  /** Up to two stops: skills or credentials. */
  stops?: string[];
}

export interface RouteMapProps {
  /** The user's current role, shown at "You are here". */
  origin: string;
  /** Up to three routes, in route order. */
  routes: MapRoute[];
  selected?: RouteIndex;
  /** Stops the travelling dot and pulse. Reduced-motion users are always still. */
  paused?: boolean;
  /** Draws the lines in once and fades the stops in when the map first mounts. Off by default. */
  entrance?: boolean;
}

const MAP_PATHS = [
  "M90 210 H300 Q340 210 360 175 L410 95 Q430 70 470 70 H1040",
  "M90 210 H1040",
  "M90 210 H300 Q340 210 360 245 L410 325 Q430 350 470 350 H1040",
];
const MAP_Y = [70, 210, 350];
/** Which of the three lines each route uses, by how many routes there are: one route runs straight, two split. */
const SLOTS: ReadonlyArray<readonly number[]> = [[1], [0, 2], [0, 1, 2]];

/** The map's right margin fits about 36 characters of destination title per line. */
const MAX_LINE = 36;

/** The origin label sits at the map's left edge, where it has room for about 16 characters per line. */
const MAX_ORIGIN_LINE = 16;

/** Splits a long title over two lines at the word break that balances them. Never wraps beyond two lines. */
function wrapTitle(title: string, max = MAX_LINE): string[] {
  if (title.length <= max) return [title];
  const words = title.split(" ");
  let best = [title];
  let bestLongest = Infinity;
  for (let i = 1; i < words.length; i++) {
    const pair = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
    const longest = Math.max(pair[0].length, pair[1].length);
    if (longest < bestLongest) {
      best = pair;
      bestLongest = longest;
    }
  }
  return best.map((l) => (l.length > max ? `${l.slice(0, max - 1)}…` : l));
}

/** The subway-style map. Always sits on surface-inverse inside the console. */
export function RouteMap({ origin, routes: allRoutes, selected = 0, paused, entrance }: RouteMapProps) {
  const reduced = usePrefersReducedMotion();
  const routes = allRoutes.slice(0, 3);
  const still = !!paused || reduced;
  const opacity = (i: number) => (i === selected ? 1 : 0.65);
  const originLines = wrapTitle(origin, MAX_ORIGIN_LINE);
  const slotOf = (i: number) => (SLOTS[routes.length - 1] ?? SLOTS[2])[i];
  const delay = (i: number): CSSProperties => ({ ["--i" as string]: i });

  const description =
    `Career route map from ${origin || "your current role"}. ` +
    routes
      .map(
        (r, i) =>
          `Route ${i + 1} to ${r.title}${r.stops?.length ? `, via ${r.stops.join(" then ")}` : ""}.`,
      )
      .join(" ") +
    ` Route ${selected + 1} is selected.`;

  return (
    <div className={cx("md-on-inverse", still && "md-map-paused", entrance && "md-map-enter")}>
      <svg className="md-map" viewBox="0 0 1200 420" role="img" aria-label={description}>
        {routes.map((_, i) => (
          <path
            key={`l${i}`}
            d={MAP_PATHS[slotOf(i)]}
            pathLength={1}
            className="md-map-line"
            style={{ stroke: route(i).inverse, opacity: opacity(i), ...delay(i) }}
          />
        ))}
        {!still && routes[selected] ? (
          <circle r={9} style={{ fill: "var(--surface-inverse)", stroke: route(selected).inverse, strokeWidth: 4 }}>
            <animateMotion dur="4.5s" repeatCount="indefinite" path={MAP_PATHS[slotOf(selected)]} />
          </circle>
        ) : null}
        <circle className="md-map-origin-ring" cx={90} cy={210} r={18} style={{ fill: "var(--blue)" }} />
        <circle cx={90} cy={210} r={18} style={{ fill: "var(--blue)", stroke: "var(--on-inverse)", strokeWidth: 3 }} />
        <circle cx={90} cy={210} r={6} style={{ fill: "var(--on-inverse)" }} />
        {routes.map((r, i) => (
          <g key={`g${i}`}>
            {(r.stops ?? []).slice(0, 2).map((_, j) => (
              <circle key={j} cx={j ? 820 : 600} cy={MAP_Y[slotOf(i)]} r={10} className="md-map-stop" style={{ opacity: opacity(i), ...delay(i) }} />
            ))}
            <circle cx={1040} cy={MAP_Y[slotOf(i)]} r={17} className="md-map-dest" style={{ opacity: opacity(i), ...delay(i) }} />
          </g>
        ))}
        <g className="md-map-svgtext">
          <text x={90} y={258} textAnchor="middle" style={{ fill: "var(--on-inverse)", fontSize: "16px", fontWeight: 700 }}>
            {originLines.map((line, k) => (
              <tspan key={k} x={90} dy={k ? 19 : 0}>
                {line}
              </tspan>
            ))}
          </text>
          <text x={90} y={278 + (originLines.length - 1) * 19} textAnchor="middle" style={{ fill: "var(--on-inverse-muted)", fontSize: "13px" }}>
            You are here
          </text>
          {routes.map((r, i) => {
            const slot = slotOf(i);
            const y = MAP_Y[slot];
            const stopOffset = slot === 2 ? -20 : 34;
            const titleY = slot === 0 ? 36 : slot === 1 ? 176 : 392;
            const lines = wrapTitle(r.title);
            // Two-line titles grow away from the line: upwards for the top and middle lines, downwards for the bottom one.
            const firstY = lines.length > 1 && slot !== 2 ? titleY - 22 : titleY;
            return (
              <g key={`t${i}`}>
                {(r.stops ?? []).slice(0, 2).map((s, j) => (
                  <text
                    key={j}
                    x={j ? 820 : 600}
                    y={y + stopOffset}
                    textAnchor="middle"
                    className="md-map-text"
                    style={{ fill: "var(--on-inverse-soft)", fontSize: "15px", opacity: opacity(i), ...delay(i) }}
                  >
                    {s}
                  </text>
                ))}
                <text
                  x={1040}
                  y={firstY}
                  textAnchor="middle"
                  className="md-map-text"
                  style={{ fill: route(i).inverseText, fontSize: "18px", fontWeight: 700, opacity: opacity(i), ...delay(i) }}
                >
                  {lines.map((line, k) => (
                    <tspan key={k} x={1040} dy={k ? 22 : 0}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="md-map-notes">
        <span style={{ fontSize: "14px", color: "var(--on-inverse-muted)" }}>
          From {origin || "your current role"} (you are here)
        </span>
        {routes.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start", opacity: i === selected ? 1 : 0.75 }}>
            <span
              style={{ width: "14px", height: "14px", flex: "none", marginTop: "4px", borderRadius: "50%", background: route(i).inverse }}
            />
            <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "16px", fontWeight: 700 }}>{r.title}</span>
              {r.stops?.length ? (
                <span style={{ fontSize: "14px", color: "var(--on-inverse-soft)" }}>via {r.stops.join(" → ")}</span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
