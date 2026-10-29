import { connection } from "next/server";
import { Suspense } from "react";
import { Button } from "@/components/ds";
import { getCurrentUser } from "@/lib/auth";

/** Sign-up button for the hero. Renders nothing for signed-in users; the page shell stays static. */
export function GuestSignUp() {
  return (
    <Suspense fallback={null}>
      <SignUpForGuests />
    </Suspense>
  );
}

async function SignUpForGuests() {
  // Keep this out of the prerender and the runtime prefetch: the auth check reads the clock.
  await connection();
  if (await getCurrentUser()) return null;
  return (
    <Button href="/auth/sign-up" variant="secondary" size="lg">
      Create an account
    </Button>
  );
}
