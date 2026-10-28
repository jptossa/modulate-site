-- Fuzzy occupation title search for the chat agent. O*NET uses formal titles ("Secondary School Teachers"),
-- so "high school teacher" matches nothing with a plain substring filter. pg_trgm similarity tolerates
-- reordered, missing and misspelled words. 761 rows, so no index is needed (a sequential scan is instant).

create or replace function public.search_occupations(q text, lim integer default 8)
returns table (soc_code text, title text, score real)
language sql stable set search_path = '' as $$
  with params as (
    select btrim(q) as q,
           replace(replace(replace(btrim(q), '\', '\\'), '%', '\%'), '_', '\_') as pattern
  )
  select o.soc_code, o.title,
         (case
            when o.title ilike '%' || p.pattern || '%' then 1.0
            else extensions.word_similarity(p.q, o.title)
          end)::real as score
  from public.occupations o, params p
  where char_length(p.q) >= 2
    and (o.title ilike '%' || p.pattern || '%' or extensions.word_similarity(p.q, o.title) >= 0.4)
  -- Ties (every substring hit scores 1.0): shorter titles first, they are usually the generic role.
  order by score desc, char_length(o.title), o.title
  limit least(greatest(lim, 1), 20);
$$;

grant execute on function public.search_occupations(text, integer) to anon, authenticated, service_role;
