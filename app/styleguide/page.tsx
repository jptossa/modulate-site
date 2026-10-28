import type { Metadata } from "next";
import { StyleguideDemo } from "./demo";
import "./styleguide.css";

export const metadata: Metadata = { title: "Styleguide" };

export default function StyleguidePage() {
  return (
    <main className="container sg-page">
      <header className="sg-section">
        <span className="eyebrow">Design system</span>
        <h1 className="type-heading" style={{ color: "var(--ink)" }}>
          Every component, <span className="accent">on example data.</span>
        </h1>
        <p className="type-lead" style={{ maxWidth: 580 }}>
          Development reference for the Modulate components. Nothing here is real market data.
        </p>
      </header>
      <StyleguideDemo />
    </main>
  );
}
