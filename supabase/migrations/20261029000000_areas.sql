-- Local job market data: BLS OEWS state, metropolitan and nonmetropolitan areas, plus the user's chosen area.
-- Reference data is public read and written only by the service role (scripts/ingest/oews-areas.mjs).
-- Area codes are BLS's own AREA values, stored as text (state FIPS, metro CBSA, nonmetro balance-of-state codes).

create table public.areas (
  area_code          text primary key,
  name               text not null,
  kind               text not null check (kind in ('national', 'state', 'metro', 'nonmetro')),
  state_abbr         text,        -- primary state, for a metro that spans several
  primary_state_code text         -- areas.area_code of that state; null for national and state rows
);
create index areas_kind on public.areas (kind);

-- Latest OEWS estimate per area and occupation. A cell BLS suppresses is null, never zero.
create table public.occupation_area_market (
  area_code         text    not null references public.areas on delete cascade,
  soc_code          text    not null references public.occupations on delete cascade,
  employment        integer,
  median_pay        integer,          -- annual, USD
  location_quotient real,             -- local share of employment / national share
  jobs_per_1000     real,
  as_of_year        integer not null,
  primary key (area_code, soc_code)
);
create index occupation_area_market_soc on public.occupation_area_market (soc_code);

alter table public.areas                  enable row level security;
alter table public.occupation_area_market enable row level security;
create policy "reference data is public" on public.areas                  for select to anon, authenticated using (true);
create policy "reference data is public" on public.occupation_area_market for select to anon, authenticated using (true);

grant select on public.areas, public.occupation_area_market to anon, authenticated;
grant all    on public.areas, public.occupation_area_market to service_role;

-- The area a signed-in user works in. Owner-only through the existing profiles policies and grants.
alter table public.profiles add column area_code text references public.areas on delete set null;

-- Fuzzy area search for the picker and the chat agent ("Austin", "texas", "bay area"). About 600 rows, so no index.
-- States rank ahead of metros and nonmetro areas on equal scores.
create or replace function public.search_areas(q text, lim integer default 8)
returns table (area_code text, name text, kind text, score real)
language sql stable set search_path = '' as $$
  with params as (
    select btrim(q) as q,
           replace(replace(replace(btrim(q), '\', '\\'), '%', '\%'), '_', '\_') as pattern
  )
  select a.area_code, a.name, a.kind,
         (case
            when a.name ilike '%' || p.pattern || '%' then 1.0
            else extensions.word_similarity(p.q, a.name)
          end)::real as score
  from public.areas a, params p
  where a.kind <> 'national'
    and char_length(p.q) >= 2
    and (a.name ilike '%' || p.pattern || '%' or extensions.word_similarity(p.q, a.name) >= 0.4)
  order by score desc,
           case a.kind when 'state' then 0 when 'metro' then 1 else 2 end,
           char_length(a.name), a.name
  limit least(greatest(lim, 1), 20);
$$;

grant execute on function public.search_areas(text, integer) to anon, authenticated, service_role;
