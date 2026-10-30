import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { RoutesSubnav } from "@/components/account/RoutesSubnav";
import { AreaPicker } from "@/components/area/AreaPicker";
import { Button } from "@/components/ds";
import { RouteVisualizer } from "@/components/visualize/RouteVisualizer";
import { StatusTrack } from "@/components/visualize/StatusTrack";
import "@/components/visualize/visualize.css";
import { getPreferredArea } from "@/lib/area";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getVisualizerData } from "@/lib/visualize/data";

export const metadata: Metadata = { title: "Visualize your routes" };

export default function VisualizePage() {
  return (
    <div className="vz-page">
      <header className="account-head">
        <h1 className="type-heading" style={{ color: "var(--ink)" }}>
          Your routes, <span className="accent">side by side.</span>
        </h1>
        <p className="type-lead">See where each saved route leads, how the market is moving, and which skills you would pick up along the way.</p>
      </header>
      <RoutesSubnav current="visualize" />
      <Suspense fallback={<p role="status">Loading your routes…</p>}>
        <Visualizer />
      </Suspense>
    </div>
  );
}

async function Visualizer() {
  // With partialPrefetching the runtime prefetch otherwise trips "unstable value Date.now()" inside Supabase auth.
  await connection();
  const user = await requireUser("/routes/visualize");
  const supabase = await createClient();

  let groups;
  let area;
  try {
    area = await getPreferredArea(supabase, user);
    groups = await getVisualizerData(supabase, user.id, area);
  } catch {
    return (
      <p role="alert" className="auth-error">
        We could not load your routes. Refresh the page to try again.
      </p>
    );
  }

  if (groups.length === 0) {
    return (
      <section className="account-empty" aria-labelledby="empty-title">
        <h2 id="empty-title" className="type-card-title" style={{ color: "var(--ink)" }}>
          No routes to draw yet
        </h2>
        <p>Ask the assistant for roles that fit your skills, then say which route to save. It will be drawn here.</p>
        <Button href="/chat">Find a route</Button>
      </section>
    );
  }

  return (
    <>
      <details className="vz-area">
        <summary>{area ? `Local figures for ${area.name}` : "Add your place to see local pay and job counts"}</summary>
        <AreaPicker current={area} id="vz-area" />
      </details>
      <RouteVisualizer groups={groups} area={area} />
      <section className="vz-card" aria-labelledby="vz-status-title">
        <div className="vz-card-title">
          <span className="eyebrow">Progress</span>
          <h2 id="vz-status-title" className="type-heading" style={{ color: "var(--ink)" }}>
            Where each route <span className="accent">stands.</span>
          </h2>
        </div>
        <StatusTrack groups={groups} />
      </section>
    </>
  );
}
