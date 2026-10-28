import { RouteKey, clamp01, overlapLevel, route, type RouteIndex, type Trend } from "./shared";
import { TrendPill } from "./indicators";

export interface RouteOptionProps {
  index: RouteIndex;
  title: string;
  trend: Trend;
  /** 0–1 */
  overlap: number;
  levelLabel?: string;
  selected?: boolean;
  onClick?: () => void;
}

/** A selectable card for one destination role; doubles as the trend chart's legend. */
export function RouteOption({ index, title, trend, overlap, levelLabel, selected, onClick }: RouteOptionProps) {
  const r = route(index);
  const v = clamp01(overlap);
  return (
    <button
      type="button"
      className="md-route"
      aria-pressed={selected ? "true" : "false"}
      onClick={onClick}
      style={selected ? { borderColor: r.light } : undefined}
    >
      <span className="md-route-head">
        <RouteKey index={index} color={r.light} />
        {title}
      </span>
      <span className="md-route-meta">
        <TrendPill trend={trend} />
        <span>{`${levelLabel ?? overlapLevel(v)} overlap`}</span>
      </span>
      <span className="md-meter" aria-hidden="true" style={{ height: "8px" }}>
        <span className="md-meter-fill" style={{ width: `${Math.round(v * 100)}%`, background: r.light }} />
      </span>
    </button>
  );
}
