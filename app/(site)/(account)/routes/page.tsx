import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { RouteCard } from "@/components/account/RouteCard";
import { Button } from "@/components/ds";
import { requireUser } from "@/lib/auth";
import { ROUTE_SELECT, toRouteRow, type RouteQueryRow } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your routes" };

export default function RoutesPage() {
  return (
    <>
      <header className="account-head">
        <h1 className="type-heading" style={{ color: "var(--ink)" }}>
          Your routes
        </h1>
        <p className="type-lead">Track each career route you are weighing, from first look to the day you arrive.</p>
      </header>
      <Suspense fallback={<p role="status">Loading your routes…</p>}>
        <RouteList />
      </Suspense>
    </>
  );
}

async function RouteList() {
  // With partialPrefetching the runtime prefetch otherwise trips "unstable value Date.now()" inside Supabase auth.
  await connection();
  const user = await requireUser("/routes");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_routes")
    .select(ROUTE_SELECT)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return (
      <p role="alert" className="auth-error">
        We could not load your routes. Refresh the page to try again.
      </p>
    );
  }

  const routes = (data as unknown as RouteQueryRow[]).map(toRouteRow);

  if (routes.length === 0) {
    return (
      <section className="account-empty" aria-labelledby="empty-title">
        <h2 id="empty-title" className="type-card-title" style={{ color: "var(--ink)" }}>
          No routes saved yet
        </h2>
        <p>Ask the assistant for roles that fit your skills, then say which route to save. It will show up here.</p>
        <Button href="/chat">Find a route</Button>
      </section>
    );
  }

  return (
    <ul className="route-list">
      {routes.map((route) => (
        <RouteCard key={route.id} route={route} />
      ))}
    </ul>
  );
}
