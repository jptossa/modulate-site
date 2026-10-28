export interface SkillListProps {
  have: string[];
  stops: string[];
  haveTitle?: string;
  stopsTitle?: string;
}

function Column({ title, items, kind }: { title: string; items: string[]; kind: "have" | "stops" }) {
  return (
    <div className="md-skills-col">
      <span className="md-skills-head">{title}</span>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
        {items.map((s, i) => (
          <li key={i} className="md-skills-item">
            {kind === "have" ? (
              <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true" style={{ flex: "none" }}>
                <circle cx={10} cy={10} r={9} style={{ fill: "var(--blue)" }} />
                <path
                  d="M6 10.5 L8.8 13.2 L14 7.5"
                  fill="none"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ stroke: "var(--on-inverse)" }}
                />
              </svg>
            ) : (
              <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true" style={{ flex: "none" }}>
                <circle
                  cx={10}
                  cy={10}
                  r={7.5}
                  strokeWidth={3}
                  style={{ fill: "var(--surface-raised)", stroke: "var(--coral-strong)" }}
                />
              </svg>
            )}
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Two columns: skills the user already has, and the stops (skills or credentials) to pick up. */
export function SkillList({ have, stops, haveTitle = "Skills you already have", stopsTitle = "Stops to pick up" }: SkillListProps) {
  return (
    <div className="md-skills">
      <Column title={haveTitle} items={have} kind="have" />
      <Column title={stopsTitle} items={stops} kind="stops" />
    </div>
  );
}
