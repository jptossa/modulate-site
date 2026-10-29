"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ds";

const ACCOUNT_LINKS = [
  { href: "/routes", label: "Routes" },
  { href: "/profile", label: "Profile" },
];

/** Header links. Uses usePathname, so render it inside <Suspense> (cacheComponents). */
export function SiteNav({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const current = (href: string) => (pathname === href ? "page" : undefined);
  // Send guests back to the page they were on; "/" has nothing to return to, so the default applies.
  const next = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";

  return (
    <nav aria-label="Main" className="site-nav">
      <Link href="/chat" aria-current={current("/chat")}>
        Chat
      </Link>
      {signedIn ? (
        <>
          {ACCOUNT_LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={current(l.href)}>
              {l.label}
            </Link>
          ))}
          <form action={signOut}>
            <Button type="submit" variant="secondary">
              Sign out
            </Button>
          </form>
        </>
      ) : (
        <>
          <Link href={`/auth/sign-in${next}`}>Sign in</Link>
          <Button href={`/auth/sign-up${next}`} variant="secondary">
            Create an account
          </Button>
        </>
      )}
    </nav>
  );
}
