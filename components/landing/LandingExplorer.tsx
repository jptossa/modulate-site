"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Button,
  Chip,
  OpeningsChart,
  OverlapMeter,
  OverlapRing,
  RouteMap,
  RouteOption,
  SegmentedControl,
  SkillList,
  StatTile,
  TrendChart,
  overlapLevel,
  type RouteIndex,
} from "@/components/ds";
import { MAX_CHARTED, canChart, chartData } from "@/lib/landing/chart-data";
import type { LandingOrigin, LandingRoute } from "@/lib/landing/types";
import { SHARE_OF_PEAK_TICKS, yearRange } from "@/lib/market/series";
import { formatChange, formatCount, formatPay } from "./format";

const COUNT_WORD = ["One", "Two", "Three"];

/**
 * Hero, route-map console, trend section and detail card. One origin chip drives all of them.
 * `signUp` and `place` are server-rendered slots, so this client component never needs the session.
 * The map and charts draw up to three routes (the design system has three route identities); the person
 * chooses which, and every other route stays in the "more routes" list.
 */
export function LandingExplorer({ origins, signUp, place }: { origins: LandingOrigin[]; signUp: ReactNode; place: ReactNode }) {
  const [originIndex, setOriginIndex] = useState(0);
  // The routes drawn on the map and charts, in route-identity order. Starts as the origin's default three.
  const [charted, setCharted] = useState<string[]>(origins[0].defaultCharted);
  const [picked, setPicked] = useState(0);
  const [showMore, setShowMore] = useState(false);
  // Bumped after the charted set changes, so focus can move to the selected route (the button that was used may be gone).
  const [focusTick, setFocusTick] = useState(0);
  const chartedRef = useRef<HTMLDivElement>(null);

  const origin = origins[originIndex];
  const data = useMemo(() => chartData(origin, charted), [origin, charted]);
  const routes = data.routes;
  const selected = Math.min(picked, routes.length - 1) as RouteIndex;
  const route = routes[selected];
  const [firstYear, lastYear] = data.years;
  const change = formatChange(route.projectedChangePct);
  const yearLabels = yearRange(firstYear, lastYear);
  const listed = origin.routes.filter((r) => !charted.includes(r.soc));

  useEffect(() => {
    if (focusTick > 0) chartedRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
  }, [focusTick]);

  const pickOrigin = (i: number) => {
    setOriginIndex(i);
    setCharted(origins[i].defaultCharted);
    setPicked(0);
    setShowMore(false);
  };

  /** Puts a listed route on the chart: added while there is room, otherwise in place of the selected route. */
  const addRoute = (soc: string) => {
    if (charted.length < MAX_CHARTED) {
      setCharted([...charted, soc]);
      setPicked(charted.length);
    } else {
      setCharted(charted.map((s, i) => (i === selected ? soc : s)));
    }
    setFocusTick((t) => t + 1);
  };

  const removeRoute = (index: number) => {
    setCharted(charted.filter((_, i) => i !== index));
    // Keep the same route selected when it moves up; if it was the one removed, the next route takes its place.
    setPicked(index < selected ? selected - 1 : Math.min(selected, charted.length - 2));
    setFocusTick((t) => t + 1);
  };

  return (
    <>
      <section className="container lp-hero" aria-labelledby="lp-hero-title">
        <h1 id="lp-hero-title" className="type-display" style={{ color: "var(--ink)" }}>
          Your next career, <span className="accent">by the numbers.</span>
        </h1>
        <p className="type-lead lp-lead">
          Pick where you are today. Modulate maps the routes your skills connect to, and what the job market says about each destination.
        </p>
        <div className="md-row">
          <Button href="/chat" size="lg">
            Build my career map
          </Button>
          {signUp}
        </div>
        <div className="lp-chips">
          <span id="lp-chips-label" className="eyebrow">
            Pick where you are today
          </span>
          <div className="md-row" role="group" aria-labelledby="lp-chips-label">
            {origins.map((o, i) => (
              <Chip key={o.soc} selected={i === originIndex} onClick={() => pickOrigin(i)}>
                {o.label}
              </Chip>
            ))}
          </div>
        </div>
        {place}
      </section>

      <section className="container" aria-labelledby="lp-console-title">
        <div className="lp-console md-on-inverse">
          <div className="lp-console-head">
            <span className="eyebrow" style={{ color: "var(--on-inverse-muted)" }}>
              {`Routes from ${origin.label}`}
            </span>
            <h2 id="lp-console-title" className="type-panel-title" style={{ color: "var(--on-inverse)" }}>
              {`${COUNT_WORD[routes.length - 1]} ${routes.length === 1 ? "route" : "routes"} from where you are`}
            </h2>
          </div>
          <SegmentedControl
            tone="inverse"
            label="Pick a route"
            value={String(selected)}
            onChange={(id) => setPicked(Number(id))}
            options={routes.map((r, i) => ({ id: String(i), label: r.title }))}
          />
          <RouteMap origin={origin.label} routes={routes.map((r) => ({ title: r.title, stops: r.stops }))} selected={selected} />
          <div className="lp-stats">
            <StatTile
              tone="inverse"
              label="Demand"
              value={route.trend}
              trend={route.trend}
              note={change ? `Projected change 2025 to 2035: ${change}` : undefined}
            />
            <StatTile tone="inverse" label="Skill overlap" value={overlapLevel(route.overlap)} meter={route.overlap} route={selected} />
            <StatTile tone="inverse" label="Median pay" value={formatPay(route.medianPay)} note="Per year" />
            <StatTile
              tone="inverse"
              label="Annual openings"
              value={formatCount(route.annualOpenings)}
              note={route.annualOpenings === null ? "BLS reports this role only as part of a group" : "Average per year, 2025 to 2035"}
            />
          </div>
          <p className="lp-live" role="status" aria-live="polite">
            {`Routes from ${origin.label}. ${routes.length} charted. Route ${selected + 1} selected: ${route.title}, demand ${route.trend.toLowerCase()}`}
          </p>
        </div>
      </section>

      <section className="container lp-section" aria-labelledby="lp-trend-title">
        <div className="lp-section-head">
          <span className="eyebrow">Annual estimates</span>
          <h2 id="lp-trend-title" className="type-heading" style={{ color: "var(--ink)" }}>
            See how each destination has <span className="accent">changed.</span>
          </h2>
        </div>
        <div className="lp-split">
          <div className="lp-card">
            <TrendChart
              kind="Line chart of annual employment estimates, indexed to the first year"
              selected={selected}
              yAxis={{ title: `Jobs, change since ${firstYear}`, ticks: data.ticks }}
              xLabels={yearLabels}
              reference={
                data.reference
                  ? { label: `Your current role: ${origin.label}`, values: data.reference, points: data.referenceChanges ?? undefined }
                  : undefined
              }
              series={routes.map((r, i) => ({
                label: r.title,
                values: data.lines[i],
                summary: `demand ${r.trend.toLowerCase()}`,
                points: data.changes[i],
              }))}
            />
            <span className="type-meta" style={{ color: "var(--ink-subtle)" }}>
              {`Annual estimates, ${firstYear} to ${lastYear}. Each line is indexed to its first year, so it shows direction, not size. BLS changed its method in 2021 and 2022, which can affect year-to-year moves. Source: BLS OEWS.`}
            </span>
          </div>
          <div className="lp-stack">
            <div ref={chartedRef} role="group" aria-label="Pick a route" className="lp-stack">
              {routes.map((r, i) => (
                <div key={r.soc} className="lp-route">
                  <RouteOption
                    index={i as RouteIndex}
                    title={r.title}
                    trend={r.trend}
                    overlap={r.overlap}
                    selected={selected === i}
                    onClick={() => setPicked(i)}
                  />
                  {routes.length > 1 ? (
                    <button type="button" className="lp-text-button" onClick={() => removeRoute(i)}>
                      Remove<span className="sr-only">{` ${r.title}`}</span> from chart
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            {listed.length > 0 ? (
              <>
                <div>
                  <Button variant="secondary" aria-expanded={showMore} aria-controls="lp-more" onClick={() => setShowMore((v) => !v)}>
                    {showMore ? "Hide more routes" : "Show more routes"}
                  </Button>
                </div>
                <div id="lp-more" hidden={!showMore}>
                  <MoreRoutes
                    origin={origin}
                    listed={listed}
                    charted={charted}
                    slot={selected}
                    replacing={charted.length >= MAX_CHARTED ? route.title : null}
                    onChart={addRoute}
                  />
                </div>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <section className="container lp-section" aria-labelledby="lp-detail-title">
        <div className="lp-split">
          <div className="lp-card" style={{ gap: "var(--space-lg)" }}>
            <h2 id="lp-detail-title" className="type-route-title" style={{ color: "var(--ink)" }}>
              {route.title}
            </h2>
            <div className="md-row" style={{ gap: "var(--space-lg)" }}>
              <OverlapRing value={route.overlap} route={selected} showLabel size={104} />
              <OverlapMeter value={route.overlap} route={selected} />
            </div>
            <SkillList
              have={route.have.length ? route.have : ["None of the top skills yet"]}
              stops={route.stops.length ? route.stops : ["Nothing to pick up in the top skills"]}
            />
          </div>
          <div className="lp-card">
            <h3 className="type-card-title" style={{ color: "var(--ink)" }}>
              {`Employment for ${route.title}`}
            </h3>
            <OpeningsChart
              kind="Bar chart"
              label={`Bar chart of annual employment estimates for ${route.title}, ${firstYear} to ${lastYear}. Each bar is a share of the highest year.`}
              values={data.bars[selected]}
              route={selected}
              highlight={2}
              yAxis={{ title: "Jobs, share of the highest year", ticks: SHARE_OF_PEAK_TICKS }}
              xLabels={yearLabels}
            />
            <span className="type-meta" style={{ color: "var(--ink-subtle)" }}>
              Annual estimates, shown against the highest year. Source: BLS OEWS.
            </span>
          </div>
        </div>
      </section>
    </>
  );
}

/** Routes not on the chart: their facts, plus a button to chart one when it can be (it needs enough annual history in common). */
function MoreRoutes({
  origin,
  listed,
  charted,
  slot,
  replacing,
  onChart,
}: {
  origin: LandingOrigin;
  listed: LandingRoute[];
  charted: string[];
  slot: number;
  /** Title of the route a new one would replace, when the chart is full. */
  replacing: string | null;
  onChart: (soc: string) => void;
}) {
  return (
    <div className="lp-more">
      <h3 className="type-card-title" style={{ color: "var(--ink)" }}>
        {`More routes from ${origin.label}`}
      </h3>
      <ul className="lp-more-list">
        {listed.map((r) => {
          const change = formatChange(r.projectedChangePct);
          const fit = canChart(origin, charted, r.soc, slot);
          return (
            <li key={r.soc} className="lp-more-item">
              <span className="lp-more-title">{r.title}</span>
              <span className="lp-more-meta">
                {[
                  `${overlapLevel(r.overlap)} overlap`,
                  `Demand ${r.trend.toLowerCase()}`,
                  r.medianPay !== null && `Median pay ${formatPay(r.medianPay)}`,
                  change && `Projected change ${change}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {r.stops.length > 0 ? <span className="lp-more-meta">{`Stops to pick up: ${r.stops.join(", ")}`}</span> : null}
              {fit.ok ? (
                <div className="lp-more-action">
                  <Button variant="secondary" onClick={() => onChart(r.soc)}>
                    {replacing ? (
                      <>
                        Chart<span className="sr-only">{` ${r.title}`}</span>
                        {` instead of ${replacing}`}
                      </>
                    ) : (
                      <>
                        Add<span className="sr-only">{` ${r.title}`}</span> to chart
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <span className="lp-more-meta">{fit.reason}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
