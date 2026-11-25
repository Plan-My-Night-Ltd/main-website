-- "Mark as booked": people tick the venues they've booked from a plan, so we know
-- who went where. One row per person, venue and night. Once the night has passed,
-- a booked venue counts as a place they've been.

create table bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  venue_slug text not null references venues (slug) on update cascade on delete cascade,
  night_date date not null,
  stop text check (stop in ('dinner', 'drinks', 'club')),
  party_size smallint check (party_size between 1 and 50),
  plan_key text,
  created_at timestamptz not null default now(),
  unique (user_id, venue_slug, night_date)
);

create index bookings_user_night_idx on bookings (user_id, night_date desc);

alter table bookings enable row level security;

create policy "People read their own bookings" on bookings for select using ((select auth.uid()) = user_id);
create policy "People add their own bookings" on bookings for insert with check ((select auth.uid()) = user_id);
create policy "People delete their own bookings" on bookings for delete using ((select auth.uid()) = user_id);

-- Who went where, newest first. Dashboard only (the analytics schema isn't exposed).
create view analytics.bookings as
select
  b.night_date,
  p.display_name as name,
  u.email,
  v.name as venue,
  v.type as venue_type,
  v.area_slug as area,
  b.stop,
  b.party_size,
  b.created_at as marked_at
from public.bookings b
join auth.users u on u.id = b.user_id
left join public.profiles p on p.id = b.user_id
left join public.venues v on v.slug = b.venue_slug
order by b.night_date desc, b.created_at desc;

revoke all on analytics.bookings from public, anon, authenticated;

-- Same as before, plus how many venues each person has marked as booked.
create or replace view analytics.users as
select
  u.id,
  p.display_name as name,
  u.email,
  coalesce(u.raw_app_meta_data ->> 'provider', 'email') as signed_up_with,
  u.created_at as signed_up_at,
  p.marketing_opt_in,
  count(sp.id) as searches,
  count(distinct (sp.created_at at time zone 'Europe/London')::date) as days_searched,
  count(distinct (sp.created_at at time zone 'Europe/London')::date) > 1 as returned,
  min(sp.created_at) as first_search_at,
  max(sp.created_at) as last_search_at,
  max(sp.updated_at) as last_active_at,
  mode() within group (order by sp.area) as usual_area,
  mode() within group (order by (sp.answers ->> 'budget')::int) as usual_budget,
  mode() within group (order by sp.answers ->> 'group') as usual_group,
  round(avg((sp.answers ->> 'partySize')::int), 1) as avg_party_size,
  (select count(*) from public.bookings b where b.user_id = u.id) as bookings
from auth.users u
left join public.profiles p on p.id = u.id
left join public.saved_plans sp on sp.user_id = u.id
group by u.id, p.display_name, p.marketing_opt_in;

revoke all on analytics.users from public, anon, authenticated;
