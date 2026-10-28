import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { safeNextPath } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage({ searchParams }: PageProps<"/auth/sign-in">) {
  return (
    <Suspense>
      <SignInForm searchParams={searchParams} />
    </Suspense>
  );
}

async function SignInForm({ searchParams }: { searchParams: PageProps<"/auth/sign-in">["searchParams"] }) {
  const { next } = await searchParams;
  // safeNextPath falls back to /chat; only pass `next` through when the user actually came from somewhere.
  const target = typeof next === "string" ? safeNextPath(next) : undefined;
  return <AuthForm mode="sign-in" next={target} />;
}
