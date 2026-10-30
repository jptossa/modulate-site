-- Cleaner place search.
-- 1. Nicknames: BLS names a metro after its principal cities ("San Francisco-Oakland-Fremont, CA"), so "bay area"
--    or "dfw" match nothing. `aliases` holds lowercase nicknames; an exact nickname match returns only those places.
-- 2. Filler words: all 137 nonmetropolitan names end in "nonmetropolitan area", so "bay area" matched every one of
--    them. "metro", "area", "region" and friends are ignored on both sides of the comparison.
-- 3. Nonmetropolitan areas rank lower unless the query says "rural" or "nonmetro".

alter table public.areas add column aliases text[] not null default '{}';

update public.areas a set aliases = v.aliases
from (values
  ('San Francisco-Oakland-Fremont, CA',           array['bay area', 'san francisco bay area', 'sf', 'san fran', 'east bay']),
  ('San Jose-Sunnyvale-Santa Clara, CA',          array['bay area', 'san francisco bay area', 'silicon valley', 'south bay']),
  ('Minneapolis-St. Paul-Bloomington, MN-WI',     array['twin cities']),
  ('Dallas-Fort Worth-Arlington, TX',             array['dfw', 'dallas fort worth', 'metroplex']),
  ('New York-Newark-Jersey City, NY-NJ',          array['nyc', 'new york city', 'manhattan', 'big apple']),
  ('Washington-Arlington-Alexandria, DC-VA-MD-WV', array['dc', 'washington dc', 'dmv']),
  ('District of Columbia',                        array['dc', 'washington dc']),
  ('Riverside-San Bernardino-Ontario, CA',        array['inland empire']),
  ('Los Angeles-Long Beach-Anaheim, CA',          array['la']),
  ('Raleigh-Cary, NC',                            array['research triangle', 'the triangle', 'triangle']),
  ('Durham-Chapel Hill, NC',                      array['research triangle', 'the triangle', 'triangle']),
  ('Seattle-Tacoma-Bellevue, WA',                 array['puget sound']),
  ('Tampa-St. Petersburg-Clearwater, FL',         array['tampa bay']),
  ('Chicago-Naperville-Elgin, IL-IN',             array['chicagoland']),
  ('Philadelphia-Camden-Wilmington, PA-NJ-DE-MD', array['philly']),
  ('Las Vegas-Henderson-North Las Vegas, NV',     array['vegas']),
  ('New Orleans-Metairie, LA',                    array['nola']),
  ('Miami-Fort Lauderdale-West Palm Beach, FL',   array['south florida']),
  ('Atlanta-Sandy Springs-Roswell, GA',           array['atl']),
  ('Phoenix-Mesa-Chandler, AZ',                   array['valley of the sun']),
  ('Salt Lake City-Murray, UT',                   array['slc']),
  ('Detroit-Warren-Dearborn, MI',                 array['metro detroit']),
  ('Virginia Beach-Chesapeake-Norfolk, VA-NC',    array['hampton roads']),
  ('Boston-Cambridge-Newton, MA-NH',              array['greater boston'])
) as v(name, aliases)
where a.name = v.name;

create or replace function public.search_areas(q text, lim integer default 8)
returns table (area_code text, name text, kind text, score real)
language sql stable set search_path = '' as $$
  with input as (
    select lower(btrim(q)) as raw,
           btrim(regexp_replace(lower(btrim(q)), '\m(nonmetropolitan|nonmetro|metropolitan|metro|areas?|region)\M', ' ', 'g')) as stripped,
           lower(q) ~ '\m(rural|nonmetro|nonmetropolitan)\M' as rural
  ),
  params as (
    -- A query that is only filler words ("metro area") is searched as typed.
    select raw, rural,
           regexp_replace(case when stripped = '' then raw else stripped end, '\s+', ' ', 'g') as q
    from input
  ),
  pattern as (
    select p.*, replace(replace(replace(p.q, '\', '\\'), '%', '\%'), '_', '\_') as pattern from params p
  ),
  aliased as (
    select a.area_code, a.name, a.kind, 1.0::real as score
    from public.areas a, pattern p
    where a.kind <> 'national' and p.raw = any (a.aliases)
  ),
  fuzzy as (
    select a.area_code, a.name, a.kind,
           (
             (case when n.clean ilike '%' || p.pattern || '%' then 1.0
                   else extensions.word_similarity(p.q, n.clean) end)
             * (case when a.kind = 'nonmetro' and not p.rural then 0.85 else 1.0 end)
           )::real as score
    from public.areas a
    cross join pattern p
    cross join lateral (
      select btrim(regexp_replace(regexp_replace(lower(a.name), '\m(nonmetropolitan|metropolitan|area|region)\M', ' ', 'g'), '\s+', ' ', 'g')) as clean
    ) n
    where a.kind <> 'national'
      and char_length(p.q) >= 2
      and not exists (select 1 from aliased)
      and (n.clean ilike '%' || p.pattern || '%' or extensions.word_similarity(p.q, n.clean) >= 0.45)
  )
  select r.area_code, r.name, r.kind, r.score
  from (select * from aliased union all select * from fuzzy) r
  order by r.score desc,
           case r.kind when 'state' then 0 when 'metro' then 1 else 2 end,
           char_length(r.name), r.name
  limit least(greatest(lim, 1), 20);
$$;

grant execute on function public.search_areas(text, integer) to anon, authenticated, service_role;
