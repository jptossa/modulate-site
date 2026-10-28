import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { safeNextPath } from "@/lib/auth";

export const metadata: Metadata = { title: "Create an account" };

export default function SignUpPage({ searchParams }: PageProps<"/auth/sign-up">) {
  return (
    <Suspense>
      <SignUpForm searchParams={searchParams} />
    </Suspense>
  );
}

async function SignUpForm({ searchParams }: { searchParams: PageProps<"/auth/sign-up">["searchParams"] }) {
  const { next } = await searchParams;
  const target = typeof next === "string" ? safeNextPath(next) : undefined;
  return <AuthForm mode="sign-up" next={target} />;
}
