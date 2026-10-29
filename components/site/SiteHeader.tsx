import { connection } from "next/server";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { getCurrentUser } from "@/lib/auth";
import { SiteNav } from "./SiteNav";

/** Logo plus main navigation. The shell is static; only the links depend on the session. */
export function SiteHeader() {
  return (
    <header className="container site-header">
      <Logo />
      <Suspense fallback={null}>
        <SessionNav />
      </Suspense>
    </header>
  );
}

async function SessionNav() {
  // Keep this out of the prerender and the runtime prefetch: the auth check reads the clock.
  await connection();
  const user = await getCurrentUser();
  return <SiteNav signedIn={user !== null} />;
}
