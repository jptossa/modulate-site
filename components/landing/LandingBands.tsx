import { Button } from "@/components/ds";

const SOURCES = [
  {
    name: "O*NET 31.0",
    use: "Skills, knowledge and how much each role needs of them. This is what skill overlap and the stops on each route are built from.",
  },
  {
    name: "O*NET Military Crosswalk",
    use: "Links military codes (Army MOS, Navy ratings, Air Force and Marine Corps codes) to the civilian roles O*NET matches them to. Built on a Defense Manpower Data Center crosswalk.",
  },
  {
    name: "BLS Employment Projections, 2025 to 2035",
    use: "Demand (Rising, Steady or Cooling), projected change, median pay and annual openings.",
  },
  {
    name: "BLS OEWS, 2019 to 2025",
    use: "Annual employment estimates behind the charts. BLS publishes no monthly openings by role, so none are shown.",
  },
];

/** Where the numbers come from, with the O*NET attribution the CC BY 4.0 licence requires. */
export function DataBand() {
  return (
    <section className="lp-band" aria-labelledby="lp-data-title">
      <div className="container lp-band-inner">
        <div className="lp-section-head">
          <span className="eyebrow">Data sources</span>
          <h2 id="lp-data-title" className="type-heading" style={{ color: "var(--ink)" }}>
            Every number comes from <span className="accent">public data.</span>
          </h2>
        </div>
        <ul className="lp-sources">
          {SOURCES.map((s) => (
            <li key={s.name} className="lp-source">
              <span className="type-card-title" style={{ color: "var(--ink)" }}>
                {s.name}
              </span>
              <span className="type-body" style={{ color: "var(--ink-muted)" }}>
                {s.use}
              </span>
            </li>
          ))}
        </ul>
        <p className="type-meta" style={{ color: "var(--ink-subtle)", maxWidth: 760 }}>
          O*NET 31.0 Database by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the CC BY 4.0
          license. O*NET® is a trademark of USDOL/ETA. Modulate has modified this information; USDOL/ETA has not approved, endorsed, or
          tested these modifications. Military Crosswalk by the U.S. Department of Labor, Employment and Training Administration, used under
          the CC BY 4.0 license; Modulate has filtered it to the roles it carries data for.
        </p>
      </div>
    </section>
  );
}

/** The one coral band on the page. */
export function CtaBand() {
  return (
    <section className="lp-cta md-on-coral" aria-labelledby="lp-cta-title">
      <div className="container lp-cta-inner">
        <h2 id="lp-cta-title" className="type-cta-heading" style={{ color: "var(--coral-ink-deep)" }}>
          Find your first stop.
        </h2>
        <p className="type-lead" style={{ color: "var(--coral-ink-deep)", maxWidth: 580 }}>
          Tell us where you are today and we will map the roles your skills already connect to.
        </p>
        <div>
          <Button href="/chat" variant="inverse" size="lg">
            Build my career map
          </Button>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="container lp-footer">
      <span className="type-meta" style={{ color: "var(--ink-subtle)" }}>
        Modulate shows market data as published by the sources above. It does not predict what any one person will earn or find.
      </span>
    </footer>
  );
}
