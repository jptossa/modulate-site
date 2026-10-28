-- Mean-centred skill similarity.
-- Raw cosine between importance x level vectors scored almost every pair of occupations 0.74-0.98 (all skills are
-- positive), so it could not separate "Very high" from "Moderate". Subtracting each skill's mean across occupations
-- spreads scores out: median ~0, closest siblings ~0.85-0.95 (checked on O*NET 31.0).

-- Mean of importance x level for each skill across rated occupations (a missing rating counts as 0). Set by the ingest script.
alter table public.skills add column mean_weight real not null default 0;

-- Dense centred vectors: every rated occupation x every skill, minus the skill's mean.
create view public.occupation_skill_centered with (security_invoker = true) as
  select o.soc_code, s.id as skill_id, coalesce(w.weight, 0) - s.mean_weight as weight
  from (select distinct soc_code from public.occupation_skills) o
  cross join public.skills s
  left join public.occupation_skill_weights w on w.soc_code = o.soc_code and w.skill_id = s.id;

-- Norms now describe the centred vectors.
drop view public.occupation_skill_norms;
create view public.occupation_skill_norms with (security_invoker = true) as
  select soc_code, sqrt(sum(weight * weight)) as norm
  from public.occupation_skill_centered
  group by soc_code;

grant select on public.occupation_skill_centered, public.occupation_skill_norms to anon, authenticated;

-- Cosine of the centred vectors, clamped at 0, so overlap stays in 0..1.
create or replace function public.adjacent_occupations(origin_soc text, lim integer default 10)
returns table (soc_code text, title text, overlap real)
language sql stable set search_path = '' as $$
  select b.soc_code, oc.title,
         greatest(0, sum(a.weight * b.weight) / nullif(an.norm * bn.norm, 0))::real as overlap
  from public.occupation_skill_centered a
  join public.occupation_skill_centered b on b.skill_id = a.skill_id and b.soc_code <> a.soc_code
  join public.occupation_skill_norms an on an.soc_code = a.soc_code
  join public.occupation_skill_norms bn on bn.soc_code = b.soc_code
  join public.occupations oc on oc.soc_code = b.soc_code
  where a.soc_code = origin_soc
  group by b.soc_code, oc.title, an.norm, bn.norm
  order by overlap desc
  limit lim;
$$;
