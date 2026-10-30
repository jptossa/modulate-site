"use client";

import { useState } from "react";
import { RouteMap, SegmentedControl, StatTile, TrendChart, overlapLevel, type RouteIndex } from "@/components/ds";
import { route } from "@/components/ds/shared";
import { formatChange, formatCount, formatLocalPay, formatPay, NOT_REPORTED } from "@/components/landing/format";
import { comparePay, describePayComparison } from "@/lib/market/compare";
import { MIN_YEARS, commonYears, indexAndScale, within, yearRange } from "@/lib/market/series";
import type { AreaRef } from "@/lib/chat/types";
import type { OriginGroup, RouteVisual } from "@/lib/visualize/data";
import { ComparisonBars } from "./ComparisonBars";
import { MAX_COMPARED, RoutePicker } from "./RoutePicker";
import { SkillMatrix } from "./SkillMatrix";

type View = "demand" | "side-by-side" | "skills";

const VIEWS: Array<{ id: View; label: string }> = [
  { id: "demand", label: "Demand over time" },
  { id: "side-by-side", label: "Side by side" },
  { id: "skills", label: "Skills" },
];

/** First three routes that are still live, so a dropped route is not on the map unless the user picks it. */
function defaultSelection(group: OriginGroup): string[] {
  const live = group.routes.filter((r) => r.status !== "dropped");
  return (live.length ? live : group.routes).slice(0, MAX_COMPARED).map((r) => r.id);
}

type Scope = "national" | "local";

/** "1.4x the U.S. share" / "About the U.S. share" / "0.6x the U.S. share". */
function formatConcentration(lq: number | null): string | undefined {
  if (lq === null) return undefined;
  const r = Math.round(lq * 10) / 10;
  return r === 1 ? "About the U.S. share" : `${r}x the U.S. share`;
}

const NO_LOCAL_ESTIMATE = "No local estimate";

const demandWord =(r: RouteVisual) => (r.trend ? `demand ${r.trend.toLowerCase()}` : "demand not reported");

/**
 * The map console and the comparison card for one origin at a time. Selection state lives here and nothing
 * is fetched on the client: every route arrives with its data, so switching is instant.
 */
export function RouteVisualizer({ groups, area }: { groups: OriginGroup[]; area: AreaRef | null }) {
  const [scope, setScope] = useState<Scope>("local");
  const [originIndex, setOriginIndex] = useState(0);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [focus, setFocus] = useState(0);
  const [view, setView] = useState<View>("demand");
  const [paused, setPaused] = useState(false);
  const [notice, setNotice] = useState("");

  const group = groups[originIndex];
  const selectedIds = picked[group.origin.soc] ?? defaultSelection(group);
  const routes = selectedIds.map((id) => group.routes.find((r) => r.id === id)).filter((r): r is RouteVisual => !!r);
  const focusIndex = Math.min(focus, routes.length - 1) as RouteIndex;
  const focused = routes[focusIndex];

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length === 1) {
        setNotice("Keep at least one route to compare.");
        return;
      }
      setPicked({ ...picked, [group.origin.soc]: selectedIds.filter((x) => x !== id) });
      setNotice("");
    } else if (selectedIds.length >= MAX_COMPARED) {
      setNotice(`You can compare up to ${MAX_COMPARED} routes. Remove one first.`);
    } else {
      setPicked({ ...picked, [group.origin.soc]: [...selectedIds, id] });
      setNotice("");
    }
  };

  const pickOrigin = (i: number) => {
    setOriginIndex(i);
    setFocus(0);
    setNotice("");
  };

  // Chart series for the compared routes that have enough history. A route left out keeps its colour and marker.
  const chart = (() => {
    const eligible = routes.map((r, i) => ({ r, i })).filter(({ r }) => r.series.length >= MIN_YEARS);
    const years = commonYears(eligible.map(({ r }) => r.series));
    if (years.length < MIN_YEARS) return null;
    const originCovers = years.every((y) => group.originSeries.some((p) => p.year === y));
    const raw = eligible.map(({ r }) => within(r.series, years));
    const scaled = indexAndScale([...raw, ...(originCovers ? [within(group.originSeries, years)] : [])]);
    return {
      years: [years[0], years[years.length - 1]] as const,
      yearLabels: yearRange(years[0], years[years.length - 1]),
      ticks: scaled.ticks,
      series: eligible.map(({ r, i }, k) => ({
        label: r.destination.title,
        values: scaled.lines[k],
        summary: demandWord(r),
        route: i as RouteIndex,
        points: scaled.changes[k],
      })),
      reference: originCovers ? { values: scaled.lines[eligible.length], points: scaled.changes[eligible.length] } : null,
      left: routes.filter((r) => r.series.length < MIN_YEARS),
    };
  })();

  const change = formatChange(focused.projectedChangePct);
  const local = area && scope === "local" ? area : null;
  const localFacts = local ? focused.local : null;
  const vsNational = localFacts ? comparePay(localFacts.medianPay, localFacts.medianPayTopCoded, focused.medianPay) : null;

  return (
    <>
      <RoutePicker groups={groups} originIndex={originIndex} onOriginChange={pickOrigin} selectedIds={selectedIds} onToggle={toggle} />
      <p className="vz-notice" role="status" aria-live="polite">
        {notice}
      </p>

      <section className="vz-console md-on-inverse" aria-labelledby="vz-console-title">
        <div className="vz-console-head">
          <div className="vz-console-title">
            <span className="eyebrow" style={{ color: "var(--on-inverse-muted)" }}>
              {`Routes from ${group.origin.title}`}
            </span>
            <h2 id="vz-console-title" className="type-panel-title" style={{ color: "var(--on-inverse)" }}>
              Your routes on the map
            </h2>
          </div>
          <button type="button" className="vz-pause" onClick={() => setPaused(!paused)}>
            <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true">
              <path
                d={paused ? "M5 3 L13 8 L5 13 Z" : "M5 3 V13 M11 3 V13"}
                fill="currentColor"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {paused ? "Play animations" : "Pause animations"}
          </button>
        </div>
        {routes.length > 1 ? (
          <SegmentedControl
            tone="inverse"
            label="Pick a route to focus on"
            value={String(focusIndex)}
            onChange={(id) => setFocus(Number(id))}
            options={routes.map((r, i) => ({ id: String(i), label: r.destination.title, swatch: route(i).inverse }))}
          />
        ) : null}
        {area ? (
          <SegmentedControl
            tone="inverse"
            label="Show pay and jobs for"
            value={scope}
            onChange={(id) => setScope(id as Scope)}
            options={[
              { id: "local", label: area.name },
              { id: "national", label: "National" },
            ]}
          />
        ) : null}
        <RouteMap
          key={group.origin.soc}
          entrance
          paused={paused}
          origin={group.origin.title}
          routes={routes.map((r) => ({ title: r.destination.title, stops: r.stops.slice(0, 2) }))}
          selected={focusIndex}
        />
        <div className="vz-stats">
          <StatTile
            tone="inverse"
            label="Demand"
            value={focused.trend ?? NOT_REPORTED}
            trend={focused.trend ?? undefined}
            note={change ? `National projected change 2025 to 2035: ${change}` : undefined}
          />
          <StatTile
            tone="inverse"
            label="Skill overlap"
            value={focused.overlap === null ? NOT_REPORTED : overlapLevel(focused.overlap)}
            meter={focused.overlap ?? undefined}
            route={focusIndex}
          />
          {local ? (
            <>
              <StatTile
                tone="inverse"
                label={`Median pay in ${local.name}`}
                value={localFacts?.medianPay != null ? formatLocalPay(localFacts.medianPay, localFacts.medianPayTopCoded) : NO_LOCAL_ESTIMATE}
                note={
                  localFacts?.medianPay == null
                    ? `BLS publishes no pay figure for this role in ${local.name}`
                    : vsNational
                      ? `${describePayComparison(vsNational)} (${formatPay(focused.medianPay)}), May ${localFacts.asOfYear}`
                      : `Per year, May ${localFacts.asOfYear}`
                }
              />
              <StatTile
                tone="inverse"
                label={`Jobs in ${local.name}`}
                value={localFacts?.employment != null ? formatCount(localFacts.employment) : NO_LOCAL_ESTIMATE}
                note={
                  localFacts?.employment == null
                    ? `BLS publishes no job count for this role in ${local.name}`
                    : (formatConcentration(localFacts.locationQuotient) ?? "Annual estimate (BLS OEWS)")
                }
              />
            </>
          ) : (
            <>
              <StatTile tone="inverse" label="Median pay" value={formatPay(focused.medianPay)} note="Per year, national" />
              <StatTile
                tone="inverse"
                label="Annual openings"
                value={formatCount(focused.annualOpenings)}
                note={focused.annualOpenings === null ? "BLS reports this role only as part of a group" : "National average per year, 2025 to 2035"}
              />
            </>
          )}
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {`Routes from ${group.origin.title}. Route ${focusIndex + 1} selected: ${focused.destination.title}, ${demandWord(focused)}`}
        </p>
      </section>

      <section className="vz-card" aria-labelledby="vz-compare-title">
        <div className="vz-card-head">
          <div className="vz-card-title">
            <span className="eyebrow">Compare</span>
            <h2 id="vz-compare-title" className="type-heading" style={{ color: "var(--ink)" }}>
              {routes.length > 1 ? (
                <>
                  Which route <span className="accent">fits best?</span>
                </>
              ) : (
                <>
                  Look closer at <span className="accent">this route.</span>
                </>
              )}
            </h2>
          </div>
          <SegmentedControl label="View" value={view} onChange={(id) => setView(id as View)} options={VIEWS} />
        </div>

        {/* Keyed by view so each view plays its entrance once when opened, and never when the selection changes. */}
        <div key={view} className="vz-view">
          {view === "demand" ? (
            chart ? (
              <>
                <TrendChart
                  animate
                  kind="Line chart of annual employment estimates, indexed to the first year"
                  selected={focusIndex}
                  yAxis={{ title: `Jobs, change since ${chart.years[0]}`, ticks: chart.ticks }}
                  xLabels={chart.yearLabels}
                  series={chart.series}
                  reference={chart.reference ? { label: `You are here: ${group.origin.title}`, ...chart.reference } : undefined}
                />
                {chart.left.length ? (
                  <p className="type-meta" style={{ color: "var(--ink-subtle)" }}>
                    {`Not on the chart, because there is not enough annual history: ${chart.left.map((r) => r.destination.title).join(", ")}.`}
                  </p>
                ) : null}
                <span className="type-meta" style={{ color: "var(--ink-subtle)" }}>
                  {`Annual estimates, ${chart.years[0]} to ${chart.years[1]}. Each line is indexed to its first year, so it shows direction, not size. BLS changed its method in 2021 and 2022, which can affect year-to-year moves. Source: BLS OEWS.`}
                </span>
              </>
            ) : (
              <p>Not enough annual history to draw these routes together. Try a different mix of routes.</p>
            )
          ) : null}

          {view === "side-by-side" ? (
            <>
              <ComparisonBars
                area={local}
                routes={routes.map((r, i) => ({
                  index: i as RouteIndex,
                  label: r.destination.title,
                  overlap: r.overlap,
                  projectedChangePct: r.projectedChangePct,
                  medianPay: r.medianPay,
                  annualOpenings: r.annualOpenings,
                  localPay: r.local?.medianPay ?? null,
                  localPayTopCoded: r.local?.medianPayTopCoded ?? false,
                  localEmployment: r.local?.employment ?? null,
                }))}
              />
              <span className="type-meta" style={{ color: "var(--ink-subtle)" }}>
                {`Each row is drawn on its own scale, so compare the routes within a row, not the rows with each other. Sources: O*NET, BLS Employment Projections 2025 to 2035${local ? `, BLS OEWS local estimates for ${local.name}` : ""}.`}
              </span>
            </>
          ) : null}

          {view === "skills" ? (
            <>
              <SkillMatrix
                routes={routes.map((r, i) => ({
                  index: i as RouteIndex,
                  label: r.destination.title,
                  overlap: r.overlap,
                  have: r.have,
                  stops: r.stops,
                }))}
              />
              <span className="type-meta" style={{ color: "var(--ink-subtle)" }}>
                {`Compared with ${group.origin.title}. Each route lists its destination's top skills. Source: O*NET.`}
              </span>
            </>
          ) : null}
        </div>
      </section>
    </>
  );
}
