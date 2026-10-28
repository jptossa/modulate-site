-- Modulate v1 schema: market reference data (public read) and user data (owner-only via RLS).

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Reference data. Written only by the service role (ingest scripts); readable by everyone.
-- ---------------------------------------------------------------------------

create table public.occupations (
  soc_code    text primary key,            -- 6-digit SOC, e.g. '25-2021'
  title       text not null,
  description text
);
create index occupations_title_trgm on public.occupations using gin (title extensions.gin_trgm_ops);

create table public.skills (
  id   integer generated always as identity primary key,
  name text not null,
  kind text not null check (kind in ('skill', 'knowledge')),
  unique (kind, name)
);

-- importance and level are both normalised to 0..1 at ingest time
-- (O*NET importance 1..5 -> (v-1)/4, level 0..7 -> v/7).
create table public.occupation_skills (
  soc_code   text    not null references public.occupations on delete cascade,
  skill_id   integer not null references public.skills on delete cascade,
  importance real    not null check (importance between 0 and 1),
  level      real    not null check (level between 0 and 1),
  primary key (soc_code, skill_id)
);
create index occupation_skills_skill on public.occupation_skills (skill_id);

create table public.occupation_market (
  soc_code             text primary key references public.occupations on delete cascade,
  employment           integer,            -- jobs, base year
  annual_openings      integer,            -- projected average annual openings
  projected_change_pct real,               -- projected employment change over the projection window
  median_pay           integer,            -- annual, USD
  trend                text check (trend in ('Rising', 'Steady', 'Cooling')),
  source               text not null,
  as_of                date not null
);

-- Annual national employment, for TrendChart / OpeningsChart. BLS publishes no monthly per-occupation series.
create table public.occupation_series (
  soc_code   text    not null references public.occupations on delete cascade,
  year       integer not null,
  employment integer not null,
  primary key (soc_code, year)
);

-- ---------------------------------------------------------------------------
-- User data
-- ---------------------------------------------------------------------------

create type public.route_status as enum ('considering', 'planning', 'in_progress', 'completed', 'dropped');

create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text,
  current_soc  text references public.occupations on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.user_skills (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users on delete cascade,
  skill_id  integer references public.skills on delete cascade,
  free_text text check (char_length(free_text) between 1 and 120),
  created_at timestamptz not null default now(),
  check ((skill_id is not null) <> (free_text is not null))
);
create unique index user_skills_unique_skill on public.user_skills (user_id, skill_id) where skill_id is not null;
create unique index user_skills_unique_text  on public.user_skills (user_id, lower(free_text)) where free_text is not null;

create table public.saved_routes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  origin_soc      text not null references public.occupations on delete cascade,
  destination_soc text not null references public.occupations on delete cascade,
  status          public.route_status not null default 'considering',
  stops           jsonb not null default '[]'::jsonb check (jsonb_typeof(stops) = 'array'),
  notes           text check (char_length(notes) <= 2000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, origin_soc, destination_soc),
  check (origin_soc <> destination_soc)
);
create index saved_routes_user on public.saved_routes (user_id, updated_at desc);

-- Guest chat rate limiting. No policies: only the service role (and the function below) touch it.
create table public.rate_limits (
  key   text    not null,
  day   date    not null default current_date,
  count integer not null default 0,
  primary key (key, day)
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_updated_at     before update on public.profiles     for each row execute function public.set_updated_at();
create trigger saved_routes_updated_at before update on public.saved_routes for each row execute function public.set_updated_at();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.occupations       enable row level security;
alter table public.skills            enable row level security;
alter table public.occupation_skills enable row level security;
alter table public.occupation_market enable row level security;
alter table public.occupation_series enable row level security;
alter table public.profiles          enable row level security;
alter table public.user_skills       enable row level security;
alter table public.saved_routes      enable row level security;
alter table public.rate_limits       enable row level security;

create policy "reference data is public" on public.occupations       for select to anon, authenticated using (true);
create policy "reference data is public" on public.skills            for select to anon, authenticated using (true);
create policy "reference data is public" on public.occupation_skills for select to anon, authenticated using (true);
create policy "reference data is public" on public.occupation_market for select to anon, authenticated using (true);
create policy "reference data is public" on public.occupation_series for select to anon, authenticated using (true);

create policy "own profile: read"   on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "own profile: insert" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "own profile: update" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "own skills" on public.user_skills for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own routes" on public.saved_routes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Skill similarity
-- ---------------------------------------------------------------------------

-- One weight per (occupation, skill): importance x level, both 0..1.
create view public.occupation_skill_weights with (security_invoker = true) as
  select soc_code, skill_id, importance * level as weight
  from public.occupation_skills;

-- Cosine similarity between skill-weight vectors, 0..1. Raw cosine runs high across occupations,
-- so the thresholds that map it to Very high / High / Good / Moderate (lib/market/overlap.ts)
-- need calibrating once real data is loaded.
create view public.occupation_skill_norms with (security_invoker = true) as
  select soc_code, sqrt(sum(weight * weight)) as norm
  from public.occupation_skill_weights
  group by soc_code;

create function public.adjacent_occupations(origin_soc text, lim integer default 10)
returns table (soc_code text, title text, overlap real)
language sql stable set search_path = '' as $$
  select b.soc_code, oc.title,
         (sum(a.weight * b.weight) / (an.norm * bn.norm))::real as overlap
  from public.occupation_skill_weights a
  join public.occupation_skill_weights b on b.skill_id = a.skill_id and b.soc_code <> a.soc_code
  join public.occupation_skill_norms an on an.soc_code = a.soc_code
  join public.occupation_skill_norms bn on bn.soc_code = b.soc_code
  join public.occupations oc on oc.soc_code = b.soc_code
  where a.soc_code = origin_soc
  group by b.soc_code, oc.title, an.norm, bn.norm
  order by overlap desc
  limit lim;
$$;

-- The destination's most heavily weighted skills, with how the origin compares.
-- has = true when the origin already covers at least 80% of the destination's weight (tunable).
create function public.skill_gap(origin_soc text, dest_soc text, lim integer default 12)
returns table (skill text, kind text, dest_weight real, origin_weight real, has boolean)
language sql stable set search_path = '' as $$
  select s.name, s.kind, d.weight, coalesce(o.weight, 0)::real,
         coalesce(o.weight, 0) >= 0.8 * d.weight
  from public.occupation_skill_weights d
  join public.skills s on s.id = d.skill_id
  left join public.occupation_skill_weights o on o.skill_id = d.skill_id and o.soc_code = origin_soc
  where d.soc_code = dest_soc
  order by d.weight desc
  limit lim;
$$;

-- ---------------------------------------------------------------------------
-- Guest rate limiting: atomically count a request, returns false once the daily limit is passed.
-- ---------------------------------------------------------------------------

create function public.bump_rate_limit(p_key text, p_limit integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  insert into public.rate_limits as r (key, day, count) values (p_key, current_date, 1)
  on conflict (key, day) do update set count = r.count + 1
  returning r.count into n;
  return n <= p_limit;
end $$;

revoke execute on function public.bump_rate_limit(text, integer) from public, anon, authenticated;
grant  execute on function public.bump_rate_limit(text, integer) to service_role;
