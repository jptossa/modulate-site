"use client";

import { useState } from "react";
import { RouteMap, RouteOption, SkillList, StatTile, TrendChart } from "@/components/ds";
import { SHARE_OF_PEAK_TICKS } from "@/lib/market/series";
import type { RouteIndex } from "@/components/ds";
import {
  isToolError,
  type AdjacentRolesOutput,
  type ListRoutesOutput,
  type MarketTrendOutput,
  type RouteStatus,
  type SaveRouteOutput,
  type SavedRouteRow,
  type SkillGapOutput,
  type UpdateRouteStatusOutput,
} from "@/lib/chat/types";

/** The parts of an AI SDK tool UI part this file reads. */
export interface ToolPart {
  type: string;
  state: string;
  output?: unknown;
  errorText?: string;
}

const WORKING_LABEL: Record<string, string> = {
  escalate: "Taking a closer look…",
  search_occupations: "Looking up roles…",
  search_areas: "Looking up places…",
  set_area: "Saving your place…",
  adjacent_roles: "Mapping adjacent roles…",
  market_trend: "Checking the job market…",
  skill_gap: "Comparing skills…",
  get_profile: "Reading your profile…",
  set_current_role: "Saving your current role…",
  add_skill: "Adding the skill…",
  list_routes: "Reading your saved routes…",
  save_route: "Saving the route…",
  update_route_status: "Updating the route…",
};

const STATUS_LABEL: Record<RouteStatus, string> = {
  considering: "Considering",
  planning: "Planning",
  in_progress: "In progress",
  completed: "Completed",
  dropped: "Dropped",
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("en-US");
const signedPct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;

/** "1.4x the U.S. share" / "About the U.S. share"; undefined when BLS gives no quotient. */
function concentrationNote(lq: number | null): string | undefined {
  if (lq === null) return undefined;
  const r = Math.round(lq * 10) / 10;
  return r === 1 ? "About the U.S. share" : `${r}x the U.S. share`;
}

export function ToolResult({ part }: { part: ToolPart }) {
  const name = part.type.replace(/^tool-/, "");

  if (part.state === "output-error") {
    return <p className="chat-tool-note" role="alert">That lookup didn&apos;t work. You can try again.</p>;
  }
  if (part.state !== "output-available") {
    return (
      <p className="chat-tool-note" role="status">
        {WORKING_LABEL[name] ?? "Working…"}
      </p>
    );
  }
  if (isToolError(part.output)) {
    return <p className="chat-tool-note">{part.output.error}</p>;
  }

  switch (name) {
    case "adjacent_roles":
      return <AdjacentCard data={part.output as AdjacentRolesOutput} />;
    case "skill_gap":
      return <SkillGapCard data={part.output as SkillGapOutput} />;
    case "market_trend":
      return <MarketCard data={part.output as MarketTrendOutput} />;
    case "list_routes":
      return <RoutesCard data={part.output as ListRoutesOutput} />;
    case "save_route":
      return <SavedRouteCard route={(part.output as SaveRouteOutput).route} note={(part.output as SaveRouteOutput).alreadySaved ? "Already saved" : "Saved"} />;
    case "update_route_status":
      return <SavedRouteCard route={(part.output as UpdateRouteStatusOutput).route} note="Updated" />;
    default:
      // search_occupations, search_areas and the profile tools have no card; the reply text carries the result.
      return null;
  }
}

function AdjacentCard({ data }: { data: AdjacentRolesOutput }) {
  const [selected, setSelected] = useState<RouteIndex>(0);
  if (data.routes.length === 0) {
    return <p className="chat-tool-note">No adjacent roles outside {data.origin.title} came back from the data.</p>;
  }
  const picked = data.routes[selected] ?? data.routes[0];
  return (
    <section className="chat-card" aria-label={`Routes from ${data.origin.title}`}>
      <div className="chat-console md-on-inverse">
        <RouteMap origin={data.origin.title} routes={data.routes.map((r) => ({ title: r.title }))} selected={selected} />
      </div>
      <div className="chat-routes">
        {data.routes.map((r, i) => (
          <div key={r.soc} className="chat-route">
            {r.trend ? (
              <RouteOption
                index={i as RouteIndex}
                title={r.title}
                trend={r.trend}
                overlap={r.overlap}
                levelLabel={r.overlapLevel}
                selected={i === selected}
                onClick={() => setSelected(i as RouteIndex)}
              />
            ) : (
              <button type="button" className="md-route" aria-pressed={i === selected} onClick={() => setSelected(i as RouteIndex)}>
                <span className="md-route-head">{r.title}</span>
                <span className="md-route-meta">{`${r.overlapLevel} overlap · trend not reported`}</span>
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="chat-facts" aria-live="polite">
        {[
          picked.medianPay !== null && `Median pay ${usd.format(picked.medianPay)}`,
          picked.projectedChangePct !== null && `${signedPct(picked.projectedChangePct)} projected employment change`,
          picked.annualOpenings !== null && `${int.format(picked.annualOpenings)} openings a year`,
          data.area && picked.local?.medianPay != null && `${usd.format(picked.local.medianPay)}${picked.local.medianPayTopCoded ? " or more" : ""} median pay in ${data.area.name}`,
          data.area && picked.local?.employment != null && `${int.format(picked.local.employment)} jobs in ${data.area.name}`,
          data.area && !picked.local && `No local estimate for ${data.area.name}`,
        ]
          .filter(Boolean)
          .join(" · ") || "No pay or openings figures reported for this role."}
      </p>
    </section>
  );
}

function SkillGapCard({ data }: { data: SkillGapOutput }) {
  return (
    <section className="chat-card" aria-label={`Skills from ${data.origin.title} to ${data.destination.title}`}>
      <h3 className="chat-card-title">{`${data.origin.title} to ${data.destination.title}`}</h3>
      <SkillList have={data.have} stops={data.stops} />
    </section>
  );
}

function MarketCard({ data }: { data: MarketTrendOutput }) {
  const m = data.market;
  const years = data.series;
  const peak = Math.max(0, ...years.map((y) => y.employment));
  return (
    <section className="chat-card" aria-label={`Job market for ${data.title}`}>
      <h3 className="chat-card-title">{data.title}</h3>
      {m ? (
        <>
          <div className="chat-stats">
            {m.trend ? <StatTile label="Demand" value={m.trend} trend={m.trend} /> : null}
            {m.projectedChangePct !== null ? <StatTile label="Projected change" value={signedPct(m.projectedChangePct)} note="Over 2025–35" /> : null}
            {m.medianPay !== null ? <StatTile label="Median pay" value={usd.format(m.medianPay)} note={data.area ? "Per year, national" : "Per year"} /> : null}
            {m.annualOpenings !== null ? <StatTile label="Openings" value={int.format(m.annualOpenings)} note="Per year, projected" /> : null}
            {m.employment !== null ? <StatTile label="Employment" value={int.format(m.employment)} note="Jobs, base year" /> : null}
          </div>
          <p className="chat-source">{`Source: ${m.source}, as of ${m.asOf}.`}</p>
        </>
      ) : (
        <p className="chat-tool-note">No market figures reported for this role.</p>
      )}
      {data.area ? (
        data.local && (data.local.employment !== null || data.local.medianPay !== null) ? (
          <>
            <div className="chat-stats">
              <StatTile
                label={`Median pay in ${data.area.name}`}
                value={data.local.medianPay !== null ? `${usd.format(data.local.medianPay)}${data.local.medianPayTopCoded ? " or more" : ""}` : "No local estimate"}
                note={data.local.medianPay !== null ? `Per year, May ${data.local.asOfYear}` : undefined}
              />
              <StatTile
                label={`Jobs in ${data.area.name}`}
                value={data.local.employment !== null ? int.format(data.local.employment) : "No local estimate"}
                note={concentrationNote(data.local.locationQuotient)}
              />
            </div>
            <p className="chat-source">{`Local source: BLS OEWS, May ${data.local.asOfYear}.`}</p>
          </>
        ) : (
          <p className="chat-tool-note">{`BLS publishes no estimate for this role in ${data.area.name}.`}</p>
        )
      ) : null}
      {years.length >= 3 && peak > 0 ? (
        <TrendChart
          series={[
            {
              label: data.title,
              values: years.map((y) => (y.employment / peak) * 100),
              points: years.map((y) => `${Math.round((y.employment / peak) * 100)}% of peak`),
            },
          ]}
          yAxis={{ title: "Jobs, share of the highest year", ticks: SHARE_OF_PEAK_TICKS }}
          xLabels={years.map((y) => String(y.year))}
          label={`Annual employment estimates for ${data.title}, ${years[0].year} to ${years[years.length - 1].year}, as a share of the highest year.`}
          kind="Annual estimates"
          legend={false}
        />
      ) : null}
    </section>
  );
}

function RouteLine({ route }: { route: SavedRouteRow }) {
  return (
    <li className="chat-saved">
      <span>{`${route.origin.title} → ${route.destination.title}`}</span>
      <span className="chat-saved-status">{STATUS_LABEL[route.status]}</span>
    </li>
  );
}

function RoutesCard({ data }: { data: ListRoutesOutput }) {
  if (data.routes.length === 0) return <p className="chat-tool-note">No saved routes yet.</p>;
  return (
    <section className="chat-card" aria-label="Your saved routes">
      <h3 className="chat-card-title">Your saved routes</h3>
      <ul className="chat-saved-list">
        {data.routes.map((r) => (
          <RouteLine key={r.id} route={r} />
        ))}
      </ul>
    </section>
  );
}

function SavedRouteCard({ route, note }: { route: SavedRouteRow; note: string }) {
  return (
    <section className="chat-card" aria-label={`${note}: saved route`}>
      <h3 className="chat-card-title">{note}</h3>
      <ul className="chat-saved-list">
        <RouteLine route={route} />
      </ul>
    </section>
  );
}
