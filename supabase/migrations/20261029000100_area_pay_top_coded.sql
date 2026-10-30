-- BLS prints "#" instead of a median wage at or above $239,200 a year. Keep the cap as median_pay and flag it,
-- so the app can say "$239,200 or more" rather than "no estimate".
alter table public.occupation_area_market add column median_pay_top_coded boolean not null default false;
