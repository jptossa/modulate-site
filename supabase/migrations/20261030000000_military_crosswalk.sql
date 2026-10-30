-- Military occupation codes (Army MOS, Navy rating, Air Force AFSC, Marine MOS, Coast Guard rating, Space Force) and the
-- O*NET-SOC roles each links to, from the O*NET Military Crosswalk (built on the DMDC MOC crosswalk, CC BY 4.0).
-- Reference data is public read and written only by the service role (scripts/ingest/military.mjs).
-- One code can mean different things per personnel category (Marine 0275 is an officer, warrant and enlisted code),
-- so a row is (branch, category, code). A code the services have since retired stays, flagged inactive, because
-- veterans hold old codes.

create table public.military_occupations (
  id       bigint generated always as identity primary key,
  branch   text not null check (branch in ('army', 'navy', 'air_force', 'marine_corps', 'coast_guard', 'space_force')),
  category text not null check (category in ('enlisted', 'officer', 'warrant')),
  code     text not null,
  code_key text not null,       -- code upper-cased with spaces, hyphens and dots removed, for lookups
  title    text not null,
  active   boolean not null,    -- false: the service has rescinded the code
  -- Titles of the roles O*NET links to this code when none of them is an occupation we carry (mostly military-only
  -- roles such as "Infantry"). Empty when the code has roles.
  other_links text[] not null default '{}',
  unique (branch, category, code)
);
create index military_occupations_code_key on public.military_occupations (code_key);

-- The roles a code links to. position is the order O*NET lists them (1-4); it is not a strength of match.
create table public.military_roles (
  military_id bigint   not null references public.military_occupations on delete cascade,
  soc_code    text     not null references public.occupations on delete cascade,
  position    smallint not null,
  primary key (military_id, soc_code)
);
create index military_roles_soc on public.military_roles (soc_code);

alter table public.military_occupations enable row level security;
alter table public.military_roles       enable row level security;
create policy "reference data is public" on public.military_occupations for select to anon, authenticated using (true);
create policy "reference data is public" on public.military_roles       for select to anon, authenticated using (true);

grant select on public.military_occupations, public.military_roles to anon, authenticated;
grant all    on public.military_occupations, public.military_roles to service_role;

-- The military code a signed-in user served in. Owner-only through the existing profiles policies and grants.
alter table public.profiles add column military_id bigint references public.military_occupations on delete set null;

-- Code or title lookup for the chat agent and the pickers ("68W", "HM", "combat medic"). About 20,000 rows, so the
-- title scan needs no index. An exact code hit returns only exact hits: "IT" is a Navy rating, and as a title
-- substring it would match half the table. Otherwise fuzzy title match. Active codes rank first.
-- Air Force and Space Force codes are written with an X for the skill level ("3D0X2"), and stored per level
-- ("3D032", "3D052", "3D072"), so an X in the fourth place matches any level.
create or replace function public.search_military(q text, lim integer default 8, branch_filter text default null)
returns table (id bigint, branch text, category text, code text, title text, active boolean, other_links text[], score real)
language sql stable set search_path = '' as $$
  with params as (
    select btrim(q) as q,
           replace(replace(replace(btrim(q), '\', '\\'), '%', '\%'), '_', '\_') as pattern,
           upper(regexp_replace(q, '[^A-Za-z0-9]', '', 'g')) as code_key
  ),
  exact as (
    select m.*, 2.0::real as score
    from public.military_occupations m, params p
    where p.code_key <> ''
      and (m.code_key = p.code_key
           or (m.branch in ('air_force', 'space_force') and p.code_key ~ '^[0-9][A-Z][0-9]X[0-9]'
               and m.code_key like substr(p.code_key, 1, 3) || '_' || substr(p.code_key, 5) || '%'))
      and (branch_filter is null or m.branch = branch_filter)
  ),
  fuzzy as (
    select m.*,
           (case
              when m.title ilike '%' || p.pattern || '%' then 1.0
              else extensions.word_similarity(p.q, m.title)
            end)::real as score
    from public.military_occupations m, params p
    where not exists (select 1 from exact)
      and char_length(p.q) >= 3
      and (branch_filter is null or m.branch = branch_filter)
      and (m.title ilike '%' || p.pattern || '%' or extensions.word_similarity(p.q, m.title) >= 0.5)
  ),
  hits as (select * from exact union all select * from fuzzy)
  select h.id, h.branch, h.category, h.code, h.title, h.active, h.other_links, h.score
  from hits h
  order by h.active desc, h.score desc, char_length(h.title), h.title, h.branch, h.category
  limit least(greatest(lim, 1), 20);
$$;

grant execute on function public.search_military(text, integer, text) to anon, authenticated, service_role;
