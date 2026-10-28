-- Explicit privileges for the API roles. Newer Supabase projects no longer auto-grant access to new
-- tables in public, so without these every request fails with 42501 before RLS is even evaluated.
-- RLS (see the init migration) still decides which rows each role can touch.

grant usage on schema public to anon, authenticated, service_role;

-- Reference data: readable by everyone.
grant select on public.occupations, public.skills, public.occupation_skills,
                public.occupation_market, public.occupation_series,
                public.occupation_skill_weights, public.occupation_skill_norms
  to anon, authenticated;

-- User data: signed-in users only. Profiles are created by the signup trigger and removed with the auth user.
grant select, insert, update         on public.profiles     to authenticated;
grant select, insert, update, delete on public.user_skills  to authenticated;
grant select, insert, update, delete on public.saved_routes to authenticated;

grant execute on function public.adjacent_occupations(text, integer) to anon, authenticated;
grant execute on function public.skill_gap(text, text, integer)      to anon, authenticated;

-- Server-side only (ingest scripts, rate limiting).
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
