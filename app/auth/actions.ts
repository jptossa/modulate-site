"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface AuthFormState {
  error?: string;
  /** Echoed back so a failed submit does not clear the form. Never includes the password. */
  email?: string;
  displayName?: string;
}

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."));
const password = z
  .string()
  .min(8, "Use at least 8 characters for your password.")
  .max(72, "Passwords can be at most 72 characters.");

const signInSchema = z.object({ email, password: z.string().min(1, "Enter your password.") });
const signUpSchema = z.object({
  email,
  password,
  displayName: z.string().trim().max(80, "Keep your name under 80 characters.").optional(),
});

const text = (formData: FormData, key: string) => {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
};

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = { email: text(formData, "email"), password: text(formData, "password") };
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, email: raw.email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Email or password is incorrect.", email: raw.email };

  redirect(safeNextPath(formData.get("next")));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = {
    email: text(formData, "email"),
    password: text(formData, "password"),
    displayName: text(formData, "displayName") || undefined,
  };
  const parsed = signUpSchema.safeParse(raw);
  const echo = { email: raw.email, displayName: raw.displayName };
  if (!parsed.success) return { error: parsed.error.issues[0].message, ...echo };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { display_name: parsed.data.displayName ?? "" } },
  });

  if (error) {
    if (error.code === "user_already_exists") {
      return { error: "An account with this email already exists. Sign in instead.", ...echo };
    }
    if (error.code === "weak_password") return { error: error.message, ...echo };
    return { error: "We could not create your account. Try again in a moment.", ...echo };
  }
  // Confirmation is off in this project, so a session comes back. If it is ever turned on, there is none yet.
  if (!data.session) {
    return { error: "Check your email to confirm your account, then sign in.", ...echo };
  }

  redirect(safeNextPath(formData.get("next")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
