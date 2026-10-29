import { OverlapRing, overlapLevel, type RouteIndex } from "@/components/ds";
import { route, type Shape } from "@/components/ds/shared";

export interface SkillMatrixRoute {
  index: RouteIndex;
  label: string;
  overlap: number | null;
  have: string[];
  stops: string[];
}

type Cell = "have" | "stop" | "none";

const CELL_TEXT: Record<Cell, string> = { have: "You have it", stop: "A stop to pick up", none: "Not in its top skills" };

/** The route's marker shape, filled when you already have the skill and outlined when it is a stop. */
function Marker({ shape, color, filled }: { shape: Shape; color: string; filled: boolean }) {
  const common = { fill: filled ? color : "none", stroke: color, strokeWidth: 2.5 } as const;
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true">
      {shape === "square" ? (
        <rect x={4} y={4} width={12} height={12} style={common} />
      ) : shape === "diamond" ? (
        <path d="M10 2.5 L17.5 10 L10 17.5 L2.5 10 Z" style={common} />
      ) : (
        <circle cx={10} cy={10} r={6.5} style={common} />
      )}
    </svg>
  );
}

/**
 * How well each compared route's top skills are covered: a ring per route, then a table of every skill
 * any of them asks for. Skills that are a stop on more than one route are listed first and called out,
 * because picking one up moves you along several routes at once.
 */
export function SkillMatrix({ routes }: { routes: SkillMatrixRoute[] }) {
  const cellOf = (r: SkillMatrixRoute, skill: string): Cell => (r.have.includes(skill) ? "have" : r.stops.includes(skill) ? "stop" : "none");

  const skills = [...new Set(routes.flatMap((r) => [...r.stops, ...r.have]))]
    .map((skill) => {
      const cells = routes.map((r) => cellOf(r, skill));
      return { skill, cells, stopCount: cells.filter((c) => c === "stop").length, haveCount: cells.filter((c) => c === "have").length };
    })
    .sort((a, b) => b.stopCount - a.stopCount || b.haveCount - a.haveCount || a.skill.localeCompare(b.skill));

  const shared = skills.filter((s) => s.stopCount > 1).map((s) => s.skill);

  return (
    <div className="vz-skills">
      <ul className="vz-rings">
        {routes.map((r) => (
          <li key={r.index} className="vz-ring">
            {r.overlap === null ? (
              <span className="type-meta" style={{ color: "var(--ink-subtle)" }}>
                Skill overlap not reported
              </span>
            ) : (
              <OverlapRing value={r.overlap} route={r.index} size={96} levelLabel={overlapLevel(r.overlap)} />
            )}
            <span className="vz-ring-label">
              <span className="type-card-title" style={{ color: "var(--ink)" }}>
                {r.label}
              </span>
              <span className="type-meta" style={{ color: "var(--ink-subtle)" }}>
                {r.overlap === null ? "Route " + (r.index + 1) : `${overlapLevel(r.overlap)} overlap`}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {shared.length ? (
        <p className="vz-callout">
          {`Stops on more than one route: ${shared.join(", ")}. Picking ${shared.length === 1 ? "it" : "them"} up helps on every route that lists ${shared.length === 1 ? "it" : "them"}.`}
        </p>
      ) : null}

      {skills.length === 0 ? (
        <p>No skill data is available for these routes.</p>
      ) : (
        <div className="vz-table-wrap">
          <table className="vz-table">
            <caption className="sr-only">
              The top skills each destination asks for, and whether you already have them or they are stops to pick up.
            </caption>
            <thead>
              <tr>
                <th scope="col">Skill</th>
                {routes.map((r) => (
                  <th key={r.index} scope="col">
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {skills.map((s, row) => (
                <tr key={s.skill} className="vz-skill-row" style={{ ["--r" as string]: row }}>
                  <th scope="row">{s.skill}</th>
                  {s.cells.map((cell, i) => (
                    <td key={routes[i].index}>
                      {cell === "none" ? (
                        <span aria-hidden="true" className="vz-none">
                          –
                        </span>
                      ) : (
                        <Marker shape={route(routes[i].index).shape} color={route(routes[i].index).light} filled={cell === "have"} />
                      )}
                      <span className="sr-only">{CELL_TEXT[cell]}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ul className="md-legend">
        <li className="md-legend-item">
          <Marker shape="circle" color="var(--ink)" filled />
          You have it
        </li>
        <li className="md-legend-item">
          <Marker shape="circle" color="var(--ink)" filled={false} />
          A stop to pick up
        </li>
        <li className="md-legend-item">
          <span aria-hidden="true" className="vz-none">
            –
          </span>
          Not in that route&apos;s top skills
        </li>
      </ul>
    </div>
  );
}
