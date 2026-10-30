-- search_military: find a code written inside a sentence. "I was a Navy HM" and "Army 68W combat medic" now match
-- the codes HM and 68W instead of falling through to a fuzzy title search that ranks "Hospital Corpsman Basic" first.
-- A word counts as a code only when it is written in capitals or digits (2+ characters), so "I", "an" and "it"
-- in ordinary prose are never read as codes; a query that is a code on its own ("hm", "68w") still matches.

create or replace function public.search_military(q text, lim integer default 8, branch_filter text default null)
returns table (id bigint, branch text, category text, code text, title text, active boolean, other_links text[], score real)
language sql stable set search_path = '' as $$
  with params as (
    select btrim(q) as q,
           replace(replace(replace(btrim(q), '\', '\\'), '%', '\%'), '_', '\_') as pattern
  ),
  keys as (
    select upper(regexp_replace(q, '[^A-Za-z0-9]', '', 'g')) as code_key from params
    union
    select upper(regexp_replace(w, '[^A-Za-z0-9]', '', 'g'))
    from params, regexp_split_to_table(params.q, '\s+') as w
    where w ~ '^[A-Z0-9][A-Z0-9-]+$'
  ),
  exact as (
    select m.*, 2.0::real as score
    from public.military_occupations m
    where exists (
            select 1 from keys k
            where k.code_key <> ''
              and (m.code_key = k.code_key
                   -- Air Force and Space Force codes are written with an X for the skill level ("3D0X2").
                   or (m.branch in ('air_force', 'space_force') and k.code_key ~ '^[0-9][A-Z][0-9]X[0-9]'
                       and m.code_key like substr(k.code_key, 1, 3) || '_' || substr(k.code_key, 5) || '%')))
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
