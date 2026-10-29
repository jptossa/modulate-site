import type { Metadata } from "next";
import { Ticker } from "@/components/ds";
import { GuestSignUp } from "@/components/landing/GuestSignUp";
import { CtaBand, DataBand, LandingFooter } from "@/components/landing/LandingBands";
import { LandingExplorer } from "@/components/landing/LandingExplorer";
import { getLandingOrigins } from "@/lib/landing/bundles";
import "./landing.css";

export const metadata: Metadata = {
  description: "Pick where you are today and see the routes your skills connect to, with demand, pay and openings from public job-market data.",
};

export default async function Home() {
  const origins = await getLandingOrigins();

  // Every destination across the chips, once each, so the ticker shows the whole range.
  const seen = new Set<string>();
  const items = origins
    .flatMap((o) => o.routes)
    .filter((r) => !seen.has(r.soc) && seen.add(r.soc))
    .map((r) => ({ role: r.title, trend: r.trend }));

  return (
    <main>
      <Ticker items={items} />
      <LandingExplorer origins={origins} signUp={<GuestSignUp />} />
      <DataBand />
      <CtaBand />
      <LandingFooter />
    </main>
  );
}
