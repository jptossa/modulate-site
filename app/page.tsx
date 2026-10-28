import { Button } from "@/components/ds";

// Placeholder until the landing page is built (plan step 6).
export default function Home() {
  return (
    <main className="container" style={{ paddingBlock: "var(--space-4xl)", display: "flex", flexDirection: "column", gap: "var(--space-xl)", alignItems: "flex-start" }}>
      <h1 className="type-display" style={{ color: "var(--ink)" }}>
        Your next career, <span className="accent">by the numbers.</span>
      </h1>
      <p className="type-lead" style={{ maxWidth: 580 }}>
        Pick where you are today. Modulate maps the routes your skills connect to.
      </p>
      <Button href="/styleguide">Explore the components</Button>
    </main>
  );
}
