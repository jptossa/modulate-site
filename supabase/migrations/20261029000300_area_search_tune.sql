-- Tuning for search_areas after trying it on real queries:
-- * "rural" / "nonmetro" in the query is a signal, not a name: it is stripped and ranks nonmetropolitan areas first.
-- * A query made only of filler words ("area", "metro area") returns nothing instead of near-random names.
-- * Weak fuzzy hits are dropped when a much better one exists ("chicago metro" no longer adds Chico).

create or replace function public.search_areas(q text, lim integer default 8)
returns table (area_code text, name text, kind text, score real)
language sql stable set search_path = '' as $$
  with input as (
    select lower(btrim(q)) as raw,
           btrim(regexp_replace(lower(btrim(q)), '\m(rural|nonmetropolitan|nonmetro|metropolitan|metro|areas?|region)\M', ' ', 'g')) as stripped,
           lower(q) ~ '\m(rural|nonmetro|nonmetropolitan)\M' as rural
  ),
  params as (
    select raw, rural, regexp_replace(stripped, '\s+', ' ', 'g') as q from input
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
             -- Nonmetropolitan areas rank down, unless the person asked for rural; then everything else does.
             * (case when (a.kind = 'nonmetro') = p.rural then 1.0 else 0.85 end)
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
  ),
  ranked as (
    select r.*, max(r.score) over () as best
    from (select * from aliased union all select * from fuzzy) r
  )
  select r.area_code, r.name, r.kind, r.score
  from ranked r
  where r.score >= r.best * 0.6
  order by r.score desc,
           case r.kind when 'state' then 0 when 'metro' then 1 else 2 end,
           char_length(r.name), r.name
  limit least(greatest(lim, 1), 20);
$$;

grant execute on function public.search_areas(text, integer) to anon, authenticated, service_role;
