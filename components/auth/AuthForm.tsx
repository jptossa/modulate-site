"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp, type AuthFormState } from "@/app/auth/actions";
import { Button } from "@/components/ds";

type Mode = "sign-in" | "sign-up";

const COPY = {
  "sign-in": {
    title: "Welcome back",
    lead: "Sign in to see the routes you have saved.",
    submit: "Sign in",
    pending: "Signing in…",
    switchText: "New to Modulate?",
    switchLink: "Create an account",
    switchHref: "/auth/sign-up",
  },
  "sign-up": {
    title: "Save your routes",
    lead: "Create an account to keep track of the careers you are considering.",
    submit: "Create my account",
    pending: "Creating your account…",
    switchText: "Already have an account?",
    switchLink: "Sign in",
    switchHref: "/auth/sign-in",
  },
} as const;

export function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
  const copy = COPY[mode];
  const [state, action, pending] = useActionState<AuthFormState, FormData>(mode === "sign-in" ? signIn : signUp, {});
  const switchHref = next ? `${copy.switchHref}?next=${encodeURIComponent(next)}` : copy.switchHref;

  return (
    <form action={action} className="auth-card" noValidate>
      <div className="auth-head">
        <h1 className="type-panel-title" style={{ color: "var(--ink)" }}>
          {copy.title}
        </h1>
        <p>{copy.lead}</p>
      </div>

      {next ? <input type="hidden" name="next" value={next} /> : null}

      {mode === "sign-up" ? (
        <div className="field">
          <label htmlFor="displayName">Name (optional)</label>
          <input id="displayName" name="displayName" type="text" autoComplete="name" defaultValue={state.displayName} />
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "auth-error" : undefined}
        />
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          required
          minLength={mode === "sign-up" ? 8 : undefined}
          aria-describedby={mode === "sign-up" ? "password-hint" : undefined}
        />
        {mode === "sign-up" ? (
          <span id="password-hint" className="hint">
            At least 8 characters.
          </span>
        ) : null}
      </div>

      {state.error ? (
        <p id="auth-error" role="alert" className="auth-error">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? copy.pending : copy.submit}
      </Button>

      <p className="auth-switch">
        {copy.switchText} <Link href={switchHref}>{copy.switchLink}</Link>
      </p>
    </form>
  );
}
