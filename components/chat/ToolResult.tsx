"use client";

import { useState, useTransition } from "react";
import { Button, RouteMap, RouteOption, SkillList, StatTile, TrendChart } from "@/components/ds";
import { setArea } from "@/lib/area-actions";
import { moreAdjacentRoutes } from "@/lib/chat/more-routes";
import { describePayComparison } from "@/lib/market/compare";
import { SHARE_OF_PEAK_TICKS } from "@/lib/market/series";
import type { RouteIndex } from "@/components/ds";
import {
  isToolError,
  type AdjacentRoute,
  type AreaRef,
  type AdjacentRolesOutput,
  type ListRoutesOutput,
  type MarketTrendOutput,
  type RouteStatus,
  type SaveRouteOutput,
  type SearchAreasOutput,
  type SearchMilitaryOutput,
  type SavedRouteRow,
  type SetMilitaryOutput,
  type SkillGapOutput,
  type UpdateRouteStatusOutput,
} from "@/lib/chat/types";
import { militaryName } from "@/lib/military/labels";

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
  search_military: "Looking up your military code…",
  set_military_background: "Saving your military background…",
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
    case "search_areas":
      return <PlacesCard data={part.output as SearchAreasOutput} />;
    case "search_military":
      return <MilitaryCard data={part.output as SearchMilitaryOutput} />;
    case "set_military_background":
      return <p className="chat-tool-note" role="status">{`Saved ${militaryName((part.output as SetMilitaryOutput).military)} to your profile.`}</p>;
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
      // search_occupations and the profile tools have no card; the reply text carries the result.
      return null;
  }
}

/** Routes with a map line and a colour; the design system has three identities. Anything past them is listed without one. */
const CHARTED = 3;

function AdjacentCard({ data }: { data: AdjacentRolesOutput }) {
  const [all, setAll] = useState<AdjacentRoute[]>(data.routes);
  // The routes on the map, in route-identity order. The person can swap a listed route into the selected slot.
  const [chartedSocs, setChartedSocs] = useState<string[]>(() => data.routes.slice(0, CHARTED).map((r) => r.soc));
  // `selectedSoc` drives the facts line (any route); `slot` is the map line that is highlighted (a charted route).
  const [selectedSoc, setSelectedSoc] = useState(chartedSocs[0]);
  const [slot, setSlot] = useState(0);
  const [phase, setPhase] = useState<"idle" | "loading" | "loaded" | "failed">("idle");
  const [pending, startTransition] = useTransition();
  const area = data.area;

  if (data.routes.length === 0) {
    return <p className="chat-tool-note">No adjacent roles outside {data.origin.title} came back from the data.</p>;
  }
  const charted = chartedSocs.map((soc) => all.find((r) => r.soc === soc)).filter((r): r is AdjacentRoute => r !== undefined);
  const listed = all.filter((r) => !chartedSocs.includes(r.soc));
  const mapSlot = Math.min(slot, charted.length - 1) as RouteIndex;
  const picked = all.find((r) => r.soc === selectedSoc) ?? charted[0];
  const full = charted.length >= CHARTED;

  const choose = (soc: string) => {
    setSelectedSoc(soc);
    const i = chartedSocs.indexOf(soc);
    if (i >= 0) setSlot(i);
  };

  /** Puts a listed route on the map: added while there is room, otherwise in place of the highlighted route. */
  const putOnMap = (soc: string) => {
    if (full) {
      setChartedSocs(chartedSocs.map((s, i) => (i === mapSlot ? soc : s)));
      setSlot(mapSlot);
    } else {
      setChartedSocs([...chartedSocs, soc]);
      setSlot(chartedSocs.length);
    }
    setSelectedSoc(soc);
  };

  const loadMore = () => {
    setPhase("loading");
    startTransition(async () => {
      const result = await moreAdjacentRoutes(data.origin.soc, area?.code ?? null);
      if (isToolError(result)) {
        setPhase("failed");
        return;
      }
      // Keep the routes already on the card, so nothing charted moves, and add the rest.
      setAll([...data.routes, ...result.routes.filter((r) => !data.routes.some((d) => d.soc === r.soc))]);
      setPhase("loaded");
    });
  };

  return (
    <section className="chat-card" aria-label={`Routes from ${data.origin.title}`}>
      <div className="chat-console md-on-inverse">
        <RouteMap origin={data.origin.title} routes={charted.map((r) => ({ title: r.title }))} selected={mapSlot} />
      </div>
      <div className="chat-routes">
        {charted.map((r, i) => (
          <div key={r.soc} className="chat-route">
            {r.trend ? (
              <RouteOption
                index={i as RouteIndex}
                title={r.title}
                trend={r.trend}
                overlap={r.overlap}
                levelLabel={r.overlapLevel}
                selected={r.soc === picked.soc}
                onClick={() => choose(r.soc)}
              />
            ) : (
              <button type="button" className="md-route" aria-pressed={r.soc === picked.soc} onClick={() => choose(r.soc)}>
                <span className="md-route-head">{r.title}</span>
                <span className="md-route-meta">{`${r.overlapLevel} overlap · trend not reported`}</span>
              </button>
            )}
          </div>
        ))}
      </div>
      {listed.length > 0 ? (
        <div className="chat-more" role="group" aria-label="More routes">
          <span className="type-label">More routes</span>
          <div className="chat-routes">
            {listed.map((r) => (
              <div key={r.soc} className="chat-route">
                <button type="button" className="md-route" aria-pressed={r.soc === picked.soc} onClick={() => choose(r.soc)}>
                  <span className="md-route-head">{r.title}</span>
                  <span className="md-route-meta">{`${r.overlapLevel} overlap · ${r.trend ? `demand ${r.trend.toLowerCase()}` : "trend not reported"}`}</span>
                </button>
                <button type="button" className="chat-text-button" onClick={() => putOnMap(r.soc)}>
                  Show<span className="sr-only">{` ${r.title}`}</span> on map{full ? ` instead of ${charted[mapSlot].title}` : ""}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {phase !== "loaded" ? (
        <div>
          <Button variant="secondary" onClick={loadMore} disabled={pending}>
            {pending ? "Loading routes…" : "Show more routes"}
          </Button>
        </div>
      ) : listed.length === 0 ? (
        <p className="chat-tool-note">No more routes came back from the data.</p>
      ) : null}
      {phase === "failed" ? (
        <p className="chat-tool-note" role="alert">
          Could not load more routes. You can try again.
        </p>
      ) : null}
      <p className="chat-facts" aria-live="polite">
        {[
          picked.medianPay !== null && `Median pay ${usd.format(picked.medianPay)}`,
          picked.projectedChangePct !== null && `${signedPct(picked.projectedChangePct)} projected employment change`,
          picked.annualOpenings !== null && `${int.format(picked.annualOpenings)} openings a year`,
          area && picked.local?.medianPay != null && `${usd.format(picked.local.medianPay)}${picked.local.medianPayTopCoded ? " or more" : ""} median pay in ${area.name}`,
          area && picked.local?.employment != null && `${int.format(picked.local.employment)} jobs in ${area.name}`,
          area && !picked.local && `No local estimate for ${area.name}`,
        ]
          .filter(Boolean)
          .join(" · ") || "No pay or openings figures reported for this role."}
      </p>
    </section>
  );
}

const PLACE_KIND: Record<AreaRef["kind"], string> = {
  national: "national",
  state: "state",
  metro: "metro area",
  nonmetro: "nonmetropolitan area",
};

/** Matching places as one-click buttons, so a guest can save a place without opening the picker. */
function PlacesCard({ data }: { data: SearchAreasOutput }) {
  const [saved, setSaved] = useState<AreaRef | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (data.results.length === 0) return null;

  const choose = (area: AreaRef) => {
    setError(null);
    startTransition(async () => {
      const result = await setArea(area.code);
      if (result.error) setError(result.error);
      else setSaved(area);
    });
  };

  return (
    <section className="chat-card" aria-label="Pick your place">
      <h3 className="chat-card-title">Pick your place</h3>
      {saved ? (
        <p className="chat-tool-note" role="status">{`Saved ${saved.name}. Local figures will use it from your next message.`}</p>
      ) : (
        <>
          <div className="md-row">
            {data.results.slice(0, 5).map((a) => (
              <Button key={a.code} variant="secondary" onClick={() => choose(a)} disabled={pending}>
                {`Use ${a.name} (${PLACE_KIND[a.kind]})`}
              </Button>
            ))}
          </div>
          {error ? (
            <p className="chat-tool-note" role="alert">
              {error}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

/** Military codes found, each with the civilian roles O*NET links it to. Nothing to press: the model carries on from the roles. */
function MilitaryCard({ data }: { data: SearchMilitaryOutput }) {
  if (data.results.length === 0) return <p className="chat-tool-note">{`No military code found for "${data.query}".`}</p>;
  return (
    <section className="chat-card" aria-label="Military code matches">
      <h3 className="chat-card-title">Military code matches</h3>
      <ul className="chat-saved-list">
        {data.results.slice(0, 5).map((m) => (
          <li key={m.id}>
            <strong>{`${militaryName(m)}, ${m.title}`}</strong>
            {m.active ? null : <span className="chat-facts">{" (retired code)"}</span>}
            <p className="chat-facts">
              {m.roles.length > 0
                ? `O*NET matches: ${m.roles.map((r) => r.title).join(", ")}`
                : `No civilian match${m.otherLinks.length > 0 ? `. O*NET lists it as ${m.otherLinks.join(", ")}` : ""}`}
            </p>
          </li>
        ))}
      </ul>
      <p className="chat-source">Source: O*NET Military Crosswalk</p>
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
                note={
                  data.local.medianPay === null
                    ? undefined
                    : data.local.payVsNational
                      ? `${describePayComparison(data.local.payVsNational)}, May ${data.local.asOfYear}`
                      : `Per year, May ${data.local.asOfYear}`
                }
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
