import { Button } from "@/components/ds";
import { InView } from "@/components/ds/InView";
import { ROUTE_STATUS_LABELS } from "@/lib/routes";
import type { OriginGroup } from "@/lib/visualize/data";

/** Stations along the line, in order. "Dropped" is not a station: those routes are listed below the line. */
const STATIONS = ["considering", "planning", "in_progress", "completed"] as const;

/**
 * A mini line with one station per status. Every saved route (not only the compared ones) waits at the
 * station for its status. Read-only: statuses are changed on the list page.
 */
export function StatusTrack({ groups }: { groups: OriginGroup[] }) {
  const all = groups.flatMap((g) => g.routes.map((r) => ({ id: r.id, status: r.status, label: `${g.origin.title} to ${r.destination.title}` })));
  const dropped = all.filter((r) => r.status === "dropped");
  let order = 0;

  return (
    <InView className="vz-status">
      <ol className="vz-line">
        {STATIONS.map((status) => {
          const here = all.filter((r) => r.status === status);
          return (
            <li key={status} className="vz-station">
              <span className="vz-station-dot" aria-hidden="true" />
              <span className="vz-station-name">{ROUTE_STATUS_LABELS[status]}</span>
              {here.length ? (
                <ul className="vz-waiting">
                  {here.map((r) => (
                    <li key={r.id} className="vz-waiting-item" style={{ ["--n" as string]: order++ }}>
                      {r.label}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="type-meta" style={{ color: "var(--ink-subtle)" }}>
                  No routes here
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {dropped.length ? (
        <p className="vz-dropped">
          <span className="vz-dropped-title">{ROUTE_STATUS_LABELS.dropped}: </span>
          {dropped.map((r) => r.label).join(", ")}
        </p>
      ) : null}
      <div>
        <Button href="/routes" variant="secondary">
          Update route statuses
        </Button>
      </div>
    </InView>
  );
}
