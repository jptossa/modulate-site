"use client";

import { useState, type ReactNode } from "react";
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
import type { LandingOrigin } from "@/lib/landing/bundles";
import { SHARE_OF_PEAK_TICKS, yearRange } from "@/lib/market/series";
import { formatChange, formatCount, formatPay } from "./format";

/**
 * Hero, route-map console, trend section and detail card. One origin chip drives all of them.
 * `signUp` is a server-rendered slot, so this client component never needs the session.
 */
export function LandingExplorer({ origins, signUp }: { origins: LandingOrigin[]; signUp: ReactNode }) {
  const [originIndex, setOriginIndex] = useState(0);
  const [selected, setSelected] = useState<RouteIndex>(0);
  const origin = origins[originIndex];
  const route = origin.routes[selected];
  const [firstYear, lastYear] = origin.years;
  const change = formatChange(route.projectedChangePct);
  const yearLabels = yearRange(firstYear, lastYear);

  const pickOrigin = (i: number) => {
    setOriginIndex(i);
    setSelected(0);
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
      </section>

      <section className="container" aria-labelledby="lp-console-title">
        <div className="lp-console md-on-inverse">
          <div className="lp-console-head">
            <span className="eyebrow" style={{ color: "var(--on-inverse-muted)" }}>
              {`Routes from ${origin.label}`}
            </span>
            <h2 id="lp-console-title" className="type-panel-title" style={{ color: "var(--on-inverse)" }}>
              Three routes from where you are
            </h2>
          </div>
          <SegmentedControl
            tone="inverse"
            label="Pick a route"
            value={String(selected)}
            onChange={(id) => setSelected(Number(id) as RouteIndex)}
            options={origin.routes.map((r, i) => ({ id: String(i), label: r.title }))}
          />
          <RouteMap
            origin={origin.label}
            routes={origin.routes.map((r) => ({ title: r.title, stops: r.stops }))}
            selected={selected}
          />
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
            {`Routes from ${origin.label}. Route ${selected + 1} selected: ${route.title}, demand ${route.trend.toLowerCase()}`}
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
              yAxis={{ title: `Jobs, change since ${firstYear}`, ticks: origin.ticks }}
              xLabels={yearLabels}
              reference={
                origin.reference
                  ? { label: `Your current role: ${origin.label}`, values: origin.reference, points: origin.referenceChanges ?? undefined }
                  : undefined
              }
              series={origin.routes.map((r, i) => ({
                label: r.title,
                values: origin.lines[i],
                summary: `demand ${r.trend.toLowerCase()}`,
                points: origin.changes[i],
              }))}
            />
            <span className="type-meta" style={{ color: "var(--ink-subtle)" }}>
              {`Annual estimates, ${firstYear} to ${lastYear}. Each line is indexed to its first year, so it shows direction, not size. BLS changed its method in 2021 and 2022, which can affect year-to-year moves. Source: BLS OEWS.`}
            </span>
          </div>
          <div role="group" aria-label="Pick a route" className="lp-stack">
            {origin.routes.map((r, i) => (
              <RouteOption
                key={r.soc}
                index={i as RouteIndex}
                title={r.title}
                trend={r.trend}
                overlap={r.overlap}
                selected={selected === i}
                onClick={() => setSelected(i as RouteIndex)}
              />
            ))}
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
              values={origin.bars[selected]}
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
