import { overlapLevel, type RouteIndex } from "@/components/ds";
import { InView } from "@/components/ds/InView";
import { RouteKey, route } from "@/components/ds/shared";
import { formatChange, formatCount, formatPay, NOT_REPORTED } from "@/components/landing/format";

export interface ComparisonRoute {
  index: RouteIndex;
  label: string;
  overlap: number | null;
  projectedChangePct: number | null;
  medianPay: number | null;
  annualOpenings: number | null;
}

interface Metric {
  id: string;
  title: string;
  /** One line saying what the measure is and where its bars start. */
  hint: string;
  value: (r: ComparisonRoute) => number | null;
  format: (r: ComparisonRoute) => string;
  /** A measure with a natural ceiling is drawn against it instead of against the largest route. */
  ceiling?: number;
}

const METRICS: Metric[] = [
  {
    id: "overlap",
    title: "Skill overlap",
    hint: "How closely your skills match each destination. Longer means closer.",
    ceiling: 1,
    value: (r) => r.overlap,
    format: (r) => (r.overlap === null ? NOT_REPORTED : overlapLevel(r.overlap)),
  },
  {
    id: "change",
    title: "Projected change, 2025 to 2035",
    hint: "Expected change in jobs. The line marks 0%: bars to its right are growth, bars to its left are decline.",
    value: (r) => r.projectedChangePct,
    format: (r) => formatChange(r.projectedChangePct) ?? NOT_REPORTED,
  },
  {
    id: "pay",
    title: "Median pay per year",
    hint: "Typical yearly pay. Bars start at $0.",
    value: (r) => r.medianPay,
    format: (r) => formatPay(r.medianPay),
  },
  {
    id: "openings",
    title: "Annual openings",
    hint: "Average job openings per year, 2025 to 2035. Bars start at 0.",
    value: (r) => r.annualOpenings,
    format: (r) => formatCount(r.annualOpenings),
  },
];

/**
 * Where the zero line sits and how far a bar reaches, as percentages of the track. A row with a negative
 * value (a shrinking role) gets room on the left of the zero line, so every bar starts at zero.
 */
function bar(value: number, all: number[], ceiling?: number) {
  const lo = Math.min(0, ...all);
  const hi = ceiling ?? Math.max(0, ...all);
  const span = hi - lo || 1;
  const zero = (-lo / span) * 100;
  const width = (Math.abs(value) / span) * 100;
  return { zero, width, left: value >= 0 ? zero : zero - width, negative: value < 0 };
}

/**
 * One row per measure, one bar per route. Bars are scaled within their row (never across rows), and the
 * value is always printed, so the bars are decoration for sighted users and the list reads on its own.
 */
export function ComparisonBars({ routes }: { routes: ComparisonRoute[] }) {
  return (
    <InView className="vz-bars">
      {METRICS.map((m) => {
        const values = routes.map(m.value).filter((v): v is number => v !== null);
        return (
          <section key={m.id} className="vz-metric" aria-labelledby={`vz-m-${m.id}`}>
            <h3 id={`vz-m-${m.id}`} className="type-card-title" style={{ color: "var(--ink)" }}>
              {m.title}
            </h3>
            <p className="type-meta" style={{ color: "var(--ink-subtle)" }}>
              {m.hint}
            </p>
            <ul className="vz-metric-rows">
              {routes.map((r, i) => {
                const v = m.value(r);
                const b = v === null ? null : bar(v, values, m.ceiling);
                return (
                  <li key={r.index} className="vz-row" style={{ ["--i" as string]: i }}>
                    <span className="vz-row-label">
                      <RouteKey index={r.index} color={route(r.index).light} />
                      {r.label}
                    </span>
                    <span className="vz-track" aria-hidden="true">
                      {b ? (
                        <>
                          {b.zero > 0 ? <span className="vz-zero" style={{ left: `${b.zero}%` }} /> : null}
                          <span
                            className={b.negative ? "vz-fill vz-fill-negative" : "vz-fill"}
                            style={{ left: `${b.left}%`, width: `${b.width}%`, background: route(r.index).light }}
                          />
                        </>
                      ) : null}
                    </span>
                    <span className="vz-value">{m.format(r)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </InView>
  );
}
