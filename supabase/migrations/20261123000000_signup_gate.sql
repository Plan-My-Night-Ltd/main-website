-- Sign-up before results: plans are now shown only to signed-in people (or friends
-- opening a shared link), so every search belongs to an account. This adds the
-- email opt-in and a private view of who's signed up and how often they come back.

-- Null means we haven't asked yet; the plan page asks once after sign-up.
alter table profiles
  add column marketing_opt_in boolean,
  add column marketing_opt_in_at timestamptz;

-- Reporting lives in its own schema, which the website's API doesn't expose, so
-- only the Supabase dashboard (SQL editor, table editor) can read it.
create schema if not exists analytics;
revoke all on schema analytics from public, anon, authenticated;

-- One row per person. A "search" is one saved_plans row (swapping a venue updates
-- the same row). They've "returned" if they searched on more than one day.
create view analytics.users as
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
  round(avg((sp.answers ->> 'partySize')::int), 1) as avg_party_size
from auth.users u
left join public.profiles p on p.id = u.id
left join public.saved_plans sp on sp.user_id = u.id
group by u.id, p.display_name, p.marketing_opt_in;

revoke all on analytics.users from public, anon, authenticated;
