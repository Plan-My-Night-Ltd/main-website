-- Control Center: a private dashboard inside the website for the PlanMyNights admin
-- account (info@planmynights.co.uk). Two parts:
--
-- 1. outbound_clicks: one row every time someone taps Book, a table time, their
--    website or Google Maps, so we know how much traffic we send to each booking
--    site and each venue. Signed-out visitors are counted too (user_id null).
--
-- 2. admin_* functions the Control Center calls. They run as the database owner
--    (security definer) so they can read every account, but each one starts by
--    checking the caller is the admin and refuses everyone else. The admin is
--    recognised by a confirmed email address, so nobody can get in by signing up
--    with that address without access to its inbox. Each returns one jsonb value,
--    which also keeps results clear of the API's 1,000 row limit.

create table outbound_clicks (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  venue_slug text not null references venues (slug) on update cascade on delete cascade,
  -- book: a booking or tickets page; website: the venue's own site; maps: Google Maps.
  kind text not null check (kind in ('book', 'website', 'maps')),
  platform text check (
    platform in ('opentable', 'sevenrooms', 'resy', 'resdiary', 'designmynight', 'thefork', 'tock', 'other')
  ),
  -- plan: the Book button on a plan; plan_time: a table time chip; venue: a venue page.
  source text not null check (source in ('plan', 'plan_time', 'venue')),
  stop text check (stop in ('dinner', 'drinks', 'club')),
  night_date date,
  party_size smallint check (party_size between 1 and 50),
  plan_key text,
  created_at timestamptz not null default now()
);

create index outbound_clicks_created_idx on outbound_clicks (created_at desc);
create index outbound_clicks_venue_idx on outbound_clicks (venue_slug, created_at desc);
create index outbound_clicks_user_idx on outbound_clicks (user_id, created_at desc) where user_id is not null;
create index bookings_created_idx on bookings (created_at desc);

alter table outbound_clicks enable row level security;

-- Anyone can log a click, but only as themselves (signed-out visitors as nobody).
-- Nobody can read clicks through the API; the admin functions below do that.
create policy "Anyone logs their own clicks" on outbound_clicks for insert
  with check (user_id is not distinct from (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Who the admin is
-- ---------------------------------------------------------------------------

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users
    where id = (select auth.uid())
      and lower(email) = 'info@planmynights.co.uk'
      and email_confirmed_at is not null
  );
$$;

create function public.assert_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only the PlanMyNights admin can see this.' using errcode = '42501';
  end if;
end;
$$;

-- Days on which each person did something: searched, came back to a plan, tapped
-- through to a venue or marked one as booked. Two or more days = a returning user.
create function public.admin_activity_days() returns table (user_id uuid, day date)
language sql stable security definer set search_path = '' as $$
  select user_id, (created_at at time zone 'Europe/London')::date from public.saved_plans
  union
  select user_id, (updated_at at time zone 'Europe/London')::date from public.saved_plans
  union
  select user_id, (created_at at time zone 'Europe/London')::date from public.bookings
  union
  select user_id, (created_at at time zone 'Europe/London')::date from public.outbound_clicks where user_id is not null;
$$;

-- ---------------------------------------------------------------------------
-- Overview: headline numbers for the period, plus a daily series
-- ---------------------------------------------------------------------------

create function public.admin_overview(p_since timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  since timestamptz := coalesce(p_since, '-infinity'::timestamptz);
  today date := (now() at time zone 'Europe/London')::date;
  -- The chart covers the period, or the last 90 days for "all time".
  series_from date := greatest(
    (coalesce(p_since, now() - interval '89 days') at time zone 'Europe/London')::date,
    today - 364
  );
  result jsonb;
begin
  perform public.assert_admin();

  with
  days as (select a.user_id, a.day from public.admin_activity_days() a),
  repeaters as (select d.user_id from days d group by d.user_id having count(*) > 1),
  active as (select distinct d.user_id from days d where d.day >= (since at time zone 'Europe/London')::date),
  series as (
    select g::date as day from generate_series(series_from, today, interval '1 day') g
  ),
  signups as (
    select (created_at at time zone 'Europe/London')::date as day, count(*) as n
    from auth.users where created_at >= series_from group by 1
  ),
  searches as (
    select (created_at at time zone 'Europe/London')::date as day, count(*) as n
    from public.saved_plans where created_at >= series_from group by 1
  ),
  clicks as (
    select (created_at at time zone 'Europe/London')::date as day, count(*) as n
    from public.outbound_clicks where created_at >= series_from group by 1
  ),
  booked as (
    select (created_at at time zone 'Europe/London')::date as day, count(*) as n
    from public.bookings where created_at >= series_from group by 1
  )
  select jsonb_build_object(
    'users_total', (select count(*) from auth.users),
    'users_new', (select count(*) from auth.users where created_at >= since),
    'opted_in', (select count(*) from public.profiles where marketing_opt_in),
    'providers', (
      select coalesce(jsonb_object_agg(provider, n), '{}'::jsonb) from (
        select coalesce(raw_app_meta_data ->> 'provider', 'email') as provider, count(*) as n
        from auth.users where created_at >= since group by 1
      ) p
    ),
    'searches', (select count(*) from public.saved_plans where created_at >= since),
    'nights_planned', (select count(distinct (user_id, night_date)) from public.saved_plans where created_at >= since),
    'searchers', (select count(distinct user_id) from public.saved_plans where created_at >= since),
    'active_users', (select count(*) from active),
    'returning_active', (select count(*) from active a join repeaters r using (user_id)),
    'returning_total', (select count(*) from repeaters),
    'ever_active', (select count(distinct user_id) from days),
    'clicks', (select count(*) from public.outbound_clicks where created_at >= since),
    'booking_clicks', (select count(*) from public.outbound_clicks where created_at >= since and kind = 'book'),
    'clickers', (select count(distinct user_id) from public.outbound_clicks where created_at >= since),
    'anonymous_clicks', (select count(*) from public.outbound_clicks where created_at >= since and user_id is null),
    'bookings', (select count(*) from public.bookings where created_at >= since),
    'covers', (select coalesce(sum(party_size), 0) from public.bookings where created_at >= since),
    'bookers', (select count(distinct user_id) from public.bookings where created_at >= since),
    'upcoming_bookings', (select count(*) from public.bookings where night_date >= today),
    'series', (
      select jsonb_agg(jsonb_build_object(
        'day', s.day,
        'signups', coalesce(su.n, 0),
        'searches', coalesce(se.n, 0),
        'clicks', coalesce(c.n, 0),
        'bookings', coalesce(b.n, 0)
      ) order by s.day)
      from series s
      left join signups su using (day)
      left join searches se using (day)
      left join clicks c using (day)
      left join booked b using (day)
    )
  ) into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- People: everyone who signed up, with how much they've used the site
-- ---------------------------------------------------------------------------

create function public.admin_users() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  perform public.assert_admin();

  with
  days as (select a.user_id, count(*) as n, max(a.day) as last_day from public.admin_activity_days() a group by a.user_id),
  plans as (
    select
      user_id,
      count(*) as searches,
      count(distinct night_date) as nights_planned,
      max(updated_at) as last_search_at,
      mode() within group (order by area) as usual_area,
      mode() within group (order by (answers ->> 'budget')::int) as usual_budget,
      mode() within group (order by answers ->> 'group') as usual_group,
      round(avg((answers ->> 'partySize')::int), 1) as avg_party_size
    from public.saved_plans group by user_id
  ),
  clicks as (select user_id, count(*) as n from public.outbound_clicks where user_id is not null group by user_id),
  booked as (select user_id, count(*) as n from public.bookings group by user_id)
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', u.id,
    'name', p.display_name,
    'email', u.email,
    'provider', coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
    'signed_up_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'confirmed', u.email_confirmed_at is not null,
    'marketing_opt_in', p.marketing_opt_in,
    'searches', coalesce(pl.searches, 0),
    'nights_planned', coalesce(pl.nights_planned, 0),
    'days_active', coalesce(d.n, 0),
    'returned', coalesce(d.n, 0) > 1,
    'last_active_on', d.last_day,
    'usual_area', pl.usual_area,
    'usual_budget', pl.usual_budget,
    'usual_group', pl.usual_group,
    'avg_party_size', pl.avg_party_size,
    'clicks', coalesce(c.n, 0),
    'bookings', coalesce(b.n, 0)
  ) order by u.created_at desc), '[]'::jsonb)
  into result
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join plans pl on pl.user_id = u.id
  left join days d on d.user_id = u.id
  left join clicks c on c.user_id = u.id
  left join booked b on b.user_id = u.id;

  return result;
end;
$$;

-- One person in full: their searches (with every answer), bookings, clicks and visits.
create function public.admin_user(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  perform public.assert_admin();

  select jsonb_build_object(
    'id', u.id,
    'name', p.display_name,
    'email', u.email,
    'provider', coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
    'signed_up_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'confirmed', u.email_confirmed_at is not null,
    'marketing_opt_in', p.marketing_opt_in,
    'marketing_opt_in_at', p.marketing_opt_in_at,
    'days_active', (select count(*) from public.admin_activity_days() a where a.user_id = u.id),
    'searches', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'plan_key', sp.plan_key, 'answers', sp.answers, 'night_date', sp.night_date,
        'created_at', sp.created_at, 'updated_at', sp.updated_at
      ) order by sp.created_at desc), '[]'::jsonb)
      from public.saved_plans sp where sp.user_id = u.id
    ),
    'bookings', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'venue_slug', b.venue_slug, 'venue', v.name, 'venue_type', v.type, 'area', v.area_slug,
        'night_date', b.night_date, 'stop', b.stop, 'party_size', b.party_size, 'created_at', b.created_at
      ) order by b.night_date desc), '[]'::jsonb)
      from public.bookings b left join public.venues v on v.slug = b.venue_slug
      where b.user_id = u.id
    ),
    'clicks', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'venue_slug', c.venue_slug, 'venue', v.name, 'kind', c.kind, 'platform', c.platform,
        'source', c.source, 'night_date', c.night_date, 'created_at', c.created_at
      ) order by c.created_at desc), '[]'::jsonb)
      from (
        select * from public.outbound_clicks where user_id = u.id order by created_at desc limit 200
      ) c left join public.venues v on v.slug = c.venue_slug
    ),
    'visits', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'venue_slug', vi.venue_slug, 'venue', v.name, 'visited_on', vi.visited_on
      ) order by vi.visited_on desc), '[]'::jsonb)
      from public.visits vi left join public.venues v on v.slug = vi.venue_slug
      where vi.user_id = u.id
    )
  )
  into result
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = p_id;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Preferences: what people chose in the questionnaire. With p_booked_only, only
-- searches for a night on which that person then marked a venue as booked.
-- ---------------------------------------------------------------------------

create function public.admin_preferences(p_since timestamptz default null, p_booked_only boolean default false)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  since timestamptz := coalesce(p_since, '-infinity'::timestamptz);
  result jsonb;
begin
  perform public.assert_admin();

  with s as (
    select sp.answers as a, sp.night_date, sp.area, sp.created_at
    from public.saved_plans sp
    where sp.created_at >= since
      and (not p_booked_only or exists (
        select 1 from public.bookings b where b.user_id = sp.user_id and b.night_date = sp.night_date
      ))
  )
  select jsonb_build_object(
    'total', (select count(*) from s),
    'group', (
      select coalesce(jsonb_agg(jsonb_build_object('key', k, 'n', n) order by n desc), '[]'::jsonb)
      from (select s.a ->> 'group' as k, count(*) as n from s group by 1) x
    ),
    'budget', (
      select coalesce(jsonb_agg(jsonb_build_object('key', k, 'n', n) order by k), '[]'::jsonb)
      from (select s.a ->> 'budget' as k, count(*) as n from s group by 1) x
    ),
    'shape', (
      select coalesce(jsonb_agg(jsonb_build_object('key', k, 'n', n) order by n desc), '[]'::jsonb)
      from (
        select array_to_string(array(
          select jsonb_array_elements_text(case jsonb_typeof(s.a -> 'stops') when 'array' then s.a -> 'stops' else '[]'::jsonb end)
        ), ',') as k, count(*) as n
        from s group by 1
      ) x
    ),
    'vibes', (
      select coalesce(jsonb_agg(jsonb_build_object('key', k, 'n', n) order by n desc), '[]'::jsonb)
      from (
        select v as k, count(*) as n
        from s cross join lateral jsonb_array_elements_text(
          case jsonb_typeof(s.a -> 'vibes') when 'array' then s.a -> 'vibes' else '[]'::jsonb end
        ) v
        group by 1
      ) x
    ),
    -- Music is only asked when the night has drinks or dancing.
    'music', (
      select coalesce(jsonb_agg(jsonb_build_object('key', k, 'n', n) order by n desc), '[]'::jsonb)
      from (
        select s.a ->> 'music' as k, count(*) as n from s
        where (s.a -> 'stops') ? 'drinks' or (s.a -> 'stops') ? 'club'
        group by 1
      ) x
    ),
    'area', (
      select coalesce(jsonb_agg(jsonb_build_object('key', k, 'n', n) order by n desc), '[]'::jsonb)
      from (select s.area as k, count(*) as n from s group by 1 order by 2 desc limit 15) x
    ),
    'party', (
      select coalesce(jsonb_agg(jsonb_build_object('key', k, 'n', n) order by min_size), '[]'::jsonb)
      from (
        select k, count(*) as n, min(size) as min_size from (
          select (s.a ->> 'partySize')::int as size,
            case
              when (s.a ->> 'partySize')::int <= 1 then 'Just one'
              when (s.a ->> 'partySize')::int = 2 then '2'
              when (s.a ->> 'partySize')::int <= 4 then '3 to 4'
              when (s.a ->> 'partySize')::int <= 8 then '5 to 8'
              else '9 or more'
            end as k
          from s
        ) y group by k
      ) x
    ),
    'start', (
      select coalesce(jsonb_agg(jsonb_build_object('key', k, 'n', n) order by k), '[]'::jsonb)
      from (select left(s.a ->> 'start', 2) || ':00' as k, count(*) as n from s group by 1) x
    ),
    -- 1 = Monday.
    'weekday', (
      select coalesce(jsonb_agg(jsonb_build_object('key', k, 'n', n) order by k), '[]'::jsonb)
      from (select extract(isodow from s.night_date)::int as k, count(*) as n from s group by 1) x
    ),
    -- How far ahead people plan: the night's date minus the day they searched.
    'lead', (
      select coalesce(jsonb_agg(jsonb_build_object('key', k, 'n', n) order by ord), '[]'::jsonb)
      from (
        select k, ord, count(*) as n from (
          select
            case
              when ahead <= 0 then 'Same day' when ahead = 1 then 'Next day' when ahead <= 7 then '2 to 7 days'
              when ahead <= 30 then '8 to 30 days' else 'More than 30 days'
            end as k,
            case when ahead <= 0 then 0 when ahead = 1 then 1 when ahead <= 7 then 2 when ahead <= 30 then 3 else 4 end as ord
          from (select s.night_date - (s.created_at at time zone 'Europe/London')::date as ahead from s) d
        ) y group by k, ord
      ) x
    )
  ) into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Traffic: clicks out to booking sites and venues, against "Mark as booked"
-- ---------------------------------------------------------------------------

create function public.admin_traffic(p_since timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  since timestamptz := coalesce(p_since, '-infinity'::timestamptz);
  result jsonb;
begin
  perform public.assert_admin();

  with
  c as (select * from public.outbound_clicks where created_at >= since),
  b as (select * from public.bookings where created_at >= since),
  -- Where a click went: the booking platform for Book links, else "website" or "maps".
  c_dest as (
    select c.*, case when c.kind = 'book' then coalesce(c.platform, 'other') else c.kind end as dest from c
  ),
  -- Where Book would have sent someone for a booked venue, worked out the same way as the site.
  b_dest as (
    select b.*,
      case
        when v.booking_url is not null then coalesce(v.booking_platform, 'other')
        when v.website_url is not null then 'website'
        else 'maps'
      end as dest
    from b left join public.venues v on v.slug = b.venue_slug
  ),
  venue_clicks as (
    select venue_slug, count(*) as clicks, count(*) filter (where kind = 'book') as book_clicks,
      count(distinct user_id) as people
    from c group by venue_slug
  ),
  venue_bookings as (select venue_slug, count(*) as bookings, coalesce(sum(party_size), 0) as covers from b group by venue_slug)
  select jsonb_build_object(
    'clicks', (select count(*) from c),
    'bookings', (select count(*) from b),
    'destinations', (
      select coalesce(jsonb_agg(jsonb_build_object('key', dest, 'clicks', clicks, 'people', people, 'bookings', bookings)
        order by clicks desc, bookings desc), '[]'::jsonb)
      from (
        select coalesce(x.dest, y.dest) as dest, coalesce(x.clicks, 0) as clicks, coalesce(x.people, 0) as people,
          coalesce(y.bookings, 0) as bookings
        from (select dest, count(*) as clicks, count(distinct user_id) as people from c_dest group by dest) x
        full join (select dest, count(*) as bookings from b_dest group by dest) y on y.dest = x.dest
      ) z
    ),
    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object('key', source, 'n', n) order by n desc), '[]'::jsonb)
      from (select source, count(*) as n from c group by source) x
    ),
    'stops', (
      select coalesce(jsonb_agg(jsonb_build_object('key', stop, 'clicks', clicks) order by clicks desc), '[]'::jsonb)
      from (select coalesce(stop, 'none') as stop, count(*) as clicks from c group by 1) x
    ),
    'areas', (
      select coalesce(jsonb_agg(jsonb_build_object('key', area, 'clicks', clicks, 'bookings', bookings)
        order by clicks desc, bookings desc), '[]'::jsonb)
      from (
        select v.area_slug as area, coalesce(sum(vc.clicks), 0) as clicks, coalesce(sum(vb.bookings), 0) as bookings
        from public.venues v
        left join venue_clicks vc on vc.venue_slug = v.slug
        left join venue_bookings vb on vb.venue_slug = v.slug
        where vc.venue_slug is not null or vb.venue_slug is not null
        group by v.area_slug
      ) x
    ),
    'venues', (
      select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.clicks desc, x.bookings desc, x.name), '[]'::jsonb)
      from (
        select v.slug, v.name, v.type, v.area_slug as area, v.booking_platform as platform,
          coalesce(vc.clicks, 0) as clicks, coalesce(vc.book_clicks, 0) as book_clicks, coalesce(vc.people, 0) as people,
          coalesce(vb.bookings, 0) as bookings, coalesce(vb.covers, 0) as covers
        from public.venues v
        left join venue_clicks vc on vc.venue_slug = v.slug
        left join venue_bookings vb on vb.venue_slug = v.slug
        where vc.venue_slug is not null or vb.venue_slug is not null
        order by coalesce(vc.clicks, 0) desc, coalesce(vb.bookings, 0) desc, v.name
        limit 100
      ) x
    )
  ) into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Bookings: every "Mark as booked", newest first, with the answers behind it
-- ---------------------------------------------------------------------------

create function public.admin_bookings(p_since timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  since timestamptz := coalesce(p_since, '-infinity'::timestamptz);
  today date := (now() at time zone 'Europe/London')::date;
  result jsonb;
begin
  perform public.assert_admin();

  with b as (select * from public.bookings where created_at >= since)
  select jsonb_build_object(
    'total', (select count(*) from b),
    'covers', (select coalesce(sum(party_size), 0) from b),
    'people', (select count(distinct user_id) from b),
    'upcoming', (select count(*) from b where night_date >= today),
    -- Booked after tapping through to that venue from us: the strongest sign the booking came through PlanMyNights.
    'after_click', (
      select count(*) from b where exists (
        select 1 from public.outbound_clicks c
        where c.user_id = b.user_id and c.venue_slug = b.venue_slug and c.created_at <= b.created_at
      )
    ),
    'by_stop', (
      select coalesce(jsonb_agg(jsonb_build_object('key', k, 'n', n) order by n desc), '[]'::jsonb)
      from (select coalesce(stop, 'none') as k, count(*) as n from b group by 1) x
    ),
    'by_type', (
      select coalesce(jsonb_agg(jsonb_build_object('key', k, 'n', n) order by n desc), '[]'::jsonb)
      from (select v.type::text as k, count(*) as n from b join public.venues v on v.slug = b.venue_slug group by 1) x
    ),
    'list', (
      select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc), '[]'::jsonb)
      from (
        select
          b.user_id, p.display_name as name, u.email,
          b.venue_slug, v.name as venue, v.type as venue_type, v.area_slug as area, v.booking_platform as platform,
          b.night_date, b.stop, b.party_size, b.created_at,
          exists (
            select 1 from public.outbound_clicks c
            where c.user_id = b.user_id and c.venue_slug = b.venue_slug and c.created_at <= b.created_at
          ) as after_click,
          plan.answers
        from b
        join auth.users u on u.id = b.user_id
        left join public.profiles p on p.id = b.user_id
        left join public.venues v on v.slug = b.venue_slug
        left join lateral (
          select sp.answers from public.saved_plans sp
          where sp.user_id = b.user_id and sp.night_date = b.night_date
          order by sp.updated_at desc limit 1
        ) plan on true
        order by b.created_at desc
        limit 500
      ) x
    )
  ) into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Venues: how complete the venue list is
-- ---------------------------------------------------------------------------

create function public.admin_catalogue() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  perform public.assert_admin();

  select jsonb_build_object(
    'total', count(*),
    'published', count(*) filter (where published),
    'verified', count(*) filter (where published and verified),
    'with_booking_url', count(*) filter (where published and booking_url is not null),
    'with_website', count(*) filter (where published and website_url is not null),
    'walk_ins_only', count(*) filter (where published and accepts_reservations = false),
    'enriched', count(*) filter (where published and booking_enriched_at is not null),
    'with_hours', count(*) filter (where published and exists (select 1 from public.venue_hours h where h.venue_id = v.id)),
    'last_import', max(last_seen_at),
    'by_type', (
      select coalesce(jsonb_object_agg(type, n), '{}'::jsonb)
      from (select type, count(*) as n from public.venues where published group by type) t
    ),
    'by_platform', (
      select coalesce(jsonb_agg(jsonb_build_object('key', k, 'n', n) order by n desc), '[]'::jsonb)
      from (
        select coalesce(booking_platform, case when booking_url is not null then 'other' else 'none' end) as k, count(*) as n
        from public.venues where published group by 1
      ) p
    ),
    'by_area', (
      select coalesce(jsonb_agg(jsonb_build_object('key', area_slug, 'n', n, 'verified', verified) order by n desc), '[]'::jsonb)
      from (
        select area_slug, count(*) as n, count(*) filter (where verified) as verified
        from public.venues where published group by area_slug
      ) a
    )
  )
  into result
  from public.venues v;

  return result;
end;
$$;

-- Supabase lets anon and authenticated run new functions by default. Only signed-in
-- people may call these at all, and the functions themselves turn away everyone but the admin.
revoke execute on function
  public.assert_admin(),
  public.admin_activity_days(),
  public.admin_overview(timestamptz),
  public.admin_users(),
  public.admin_user(uuid),
  public.admin_preferences(timestamptz, boolean),
  public.admin_traffic(timestamptz),
  public.admin_bookings(timestamptz),
  public.admin_catalogue()
from public, anon, authenticated;

grant execute on function
  public.admin_overview(timestamptz),
  public.admin_users(),
  public.admin_user(uuid),
  public.admin_preferences(timestamptz, boolean),
  public.admin_traffic(timestamptz),
  public.admin_bookings(timestamptz),
  public.admin_catalogue()
to authenticated;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
