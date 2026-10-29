"use client";

import { useState } from "react";
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
  Ticker,
  TrendChart,
  TrendPill,
  type RouteIndex,
} from "@/components/ds";
import { ComparisonBars } from "@/components/visualize/ComparisonBars";
import { SkillMatrix } from "@/components/visualize/SkillMatrix";
import "@/components/visualize/visualize.css";

/* Example data only. Every chart on this page is labelled "Illustrative". */
const ROUTES = [
  { title: "Instructional Designer", stops: ["Learning design", "Authoring tools"], trend: "Rising" as const, overlap: 0.82 },
  { title: "Customer Success Manager", stops: ["CRM basics", "Account planning"], trend: "Steady" as const, overlap: 0.7 },
  { title: "HR Coordinator", stops: ["HR fundamentals", "Compliance"], trend: "Cooling" as const, overlap: 0.62 },
];
const SERIES = [
  [30, 34, 38, 42, 47, 52, 58, 62, 69, 75, 82, 88],
  [55, 56, 55, 57, 56, 58, 57, 58, 57, 58, 59, 58],
  [70, 68, 66, 63, 60, 57, 55, 52, 49, 46, 43, 40],
];

const COMPARE = ROUTES.map((r, i) => ({
  index: i as RouteIndex,
  label: r.title,
  overlap: r.overlap,
  projectedChangePct: [12, 3, -4][i],
  medianPay: [68000, 74000, 61000][i],
  annualOpenings: [9000, 24000, null][i],
}));
const MATRIX = ROUTES.map((r, i) => ({
  index: i as RouteIndex,
  label: r.title,
  overlap: r.overlap,
  have: [["Explaining complex ideas", "Planning lessons"], ["Explaining complex ideas"], ["Planning lessons"]][i],
  stops: [r.stops, [r.stops[0], "Compliance"], [r.stops[1], r.stops[0]]][i],
}));

export function StyleguideDemo() {
  const [selected, setSelected] = useState<RouteIndex>(0);
  const [role, setRole] = useState("teacher");
  const route = ROUTES[selected];

  return (
    <>
      <section className="sg-section">
        <h2 className="type-card-title">Buttons, chips and trend pills</h2>
        <div className="md-row">
          <Button>Build my career map</Button>
          <Button variant="secondary">Explore an example</Button>
          <Button variant="primary" size="lg">
            Plan this route
          </Button>
        </div>
        <div className="md-row" role="group" aria-label="Pick your current role">
          {["teacher", "store-manager", "nurse"].map((id) => (
            <Chip key={id} selected={role === id} onClick={() => setRole(id)}>
              {id === "teacher" ? "Teacher" : id === "store-manager" ? "Store manager" : "Nurse"}
            </Chip>
          ))}
        </div>
        <div className="md-row">
          <TrendPill trend="Rising" />
          <TrendPill trend="Steady" />
          <TrendPill trend="Cooling" />
        </div>
      </section>

      <section className="sg-section">
        <h2 className="type-card-title">Ticker</h2>
        <Ticker
          items={[
            { role: "Instructional Designer", trend: "Rising" },
            { role: "Customer Success Manager", trend: "Steady" },
            { role: "HR Coordinator", trend: "Cooling" },
          ]}
        />
      </section>

      <section className="sg-console md-on-inverse">
        <h2 className="type-panel-title" style={{ color: "var(--on-inverse)" }}>
          Your route map
        </h2>
        <SegmentedControl
          tone="inverse"
          label="Pick a route"
          value={String(selected)}
          onChange={(id) => setSelected(Number(id) as RouteIndex)}
          options={ROUTES.map((r, i) => ({ id: String(i), label: r.title }))}
        />
        <RouteMap origin="Teacher" routes={ROUTES} selected={selected} />
        <div className="sg-grid">
          <StatTile tone="inverse" label="Demand" value={route.trend} trend={route.trend} />
          <StatTile tone="inverse" label="Skill overlap" value="[LEVEL]" meter={route.overlap} route={selected} />
          <StatTile tone="inverse" label="Pay range" value="[PAY RANGE]" />
          <StatTile tone="inverse" label="Time to switch" value="[TIME]" />
        </div>
        <p className="sg-live" role="status" aria-live="polite">
          {`Route ${selected + 1} selected: ${route.title}, demand ${route.trend.toLowerCase()}`}
        </p>
      </section>

      <section className="sg-section">
        <h2 className="type-card-title">Trends and route options (Illustrative)</h2>
        <div className="sg-split">
          <div className="sg-card">
            <TrendChart
              kind="Illustrative line chart"
              selected={selected}
              reference={{ label: "Your current role", values: SERIES[1].map((v) => v - 8) }}
              series={ROUTES.map((r, i) => ({ label: r.title, values: SERIES[i], summary: `demand ${r.trend.toLowerCase()}` }))}
            />
            <span className="type-meta" style={{ color: "var(--ink-subtle)" }}>
              Illustrative · Source: [DATA SOURCES]
            </span>
          </div>
          <div role="group" aria-label="Pick a route" className="sg-stack">
            {ROUTES.map((r, i) => (
              <RouteOption
                key={r.title}
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

      <section className="sg-section">
        <h2 className="type-card-title">Detail card (Illustrative)</h2>
        <div className="sg-split">
          <div className="sg-card" style={{ gap: "var(--space-lg)" }}>
            <h3 className="type-route-title" style={{ color: "var(--ink)" }}>
              {route.title}
            </h3>
            <div className="md-row" style={{ gap: "var(--space-lg)" }}>
              <OverlapRing value={route.overlap} route={selected} showLabel size={104} />
              <OverlapMeter value={route.overlap} route={selected} />
            </div>
            <SkillList have={["Explaining complex ideas", "Planning lessons"]} stops={route.stops} />
          </div>
          <div className="sg-card">
            <h3 className="type-card-title" style={{ color: "var(--ink)" }}>
              {`Openings for ${route.title}`}
            </h3>
            <OpeningsChart
              kind="Illustrative bar chart"
              values={SERIES[selected]}
              route={selected}
              title={route.title}
              summary={`demand ${route.trend.toLowerCase()}`}
            />
          </div>
        </div>
      </section>

      <section className="sg-section">
        <h2 className="type-card-title">Comparison bars and skill matrix (Illustrative)</h2>
        <div className="sg-split">
          <div className="sg-card">
            <ComparisonBars routes={COMPARE} />
          </div>
          <div className="sg-card">
            <SkillMatrix routes={MATRIX} />
          </div>
        </div>
      </section>
    </>
  );
}
