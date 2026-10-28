function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env.local and fill it in.`);
  }
  return value;
}

// NEXT_PUBLIC_* values must be referenced literally so Next can inline them into client bundles.
// The client wants the project root (https://<ref>.supabase.co). Dashboard "API URL" values sometimes
// carry a /rest/v1/ suffix, which would break the auth and REST paths the client appends, so keep only the origin.
export const supabaseUrl = () =>
  new URL(required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)).origin;
export const supabaseAnonKey = () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
export const supabaseServiceRoleKey = () => required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
