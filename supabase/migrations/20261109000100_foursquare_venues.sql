-- Venues now come mainly from the monthly Foursquare import (scripts/import-venues.mts),
-- which covers every restaurant, bar and club in the 30 areas. Checking a venue by
-- hand adds the details Foursquare doesn't have and sets `verified`.
--
-- The import owns: name, type, area, address, coordinates, nearest Tube, price band,
-- rating, hours and the fsq_* / auto_* columns. It never writes vibe_tags,
-- music_tags, dress_code, door_policy, description, booking_url or published on an
-- existing venue, so hand edits survive every refresh. On verified venues it only
-- refreshes rating, tastes and last_seen_at.

alter table venues
  add column rating numeric(3, 1),
  add column fsq_categories text[] not null default '{}',
  add column fsq_tastes text[] not null default '{}',
  add column auto_vibe_tags text[] not null default '{}',
  add column auto_music_tags text[] not null default '{}',
  add column verified boolean not null default false,
  add column last_seen_at timestamptz;

-- Results are stored as venues now, so the raw response cache isn't needed.
drop table foursquare_cache;

create view area_venue_counts with (security_invoker = true) as
  select area_slug, count(*)::int as venues
  from venues
  where published
  group by area_slug;

-- Shortlist for one stop of a plan: hard filters (type, open that weekday, budget,
-- where), then a rough score so the app gets the best `p_limit` out of thousands.
-- The app does the exact timing, travel and final scoring on what comes back.
create function plan_candidates(
  p_type venue_type,
  p_weekday int,
  p_budget int,
  p_vibes text[] default '{}',
  p_music text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default null,
  p_area_slugs text[] default null,
  p_limit int default 150
) returns setof venues
language sql stable
set search_path = ''
as $$
  select v.*
  from public.venues v
  cross join lateral (
    select case when p_lat is null then 0 else
      2 * 6371 * asin(sqrt(
        power(sin(radians(v.lat - p_lat) / 2), 2)
        + cos(radians(p_lat)) * cos(radians(v.lat)) * power(sin(radians(v.lng - p_lng) / 2), 2)
      )) end as km
  ) d
  where v.published
    and v.type = p_type
    and exists (select 1 from public.venue_hours h where h.venue_id = v.id and h.weekday = p_weekday)
    and (v.price_band is null or abs(v.price_band - p_budget) <= 1)
    and (p_area_slugs is null or v.area_slug = any (p_area_slugs))
    and (p_radius_km is null or d.km <= p_radius_km)
  order by
    (case when v.verified then 2 else 0 end)
    + 3 * cardinality(array(select unnest(v.vibe_tags || v.auto_vibe_tags) intersect select unnest(p_vibes)))
    + (case when p_music is not null and p_music = any (v.music_tags || v.auto_music_tags) then 4 else 0 end)
    + (case when v.price_band = p_budget then 3 else 0 end)
    + coalesce(v.rating, 6) / 2
    - d.km desc,
    v.name
  limit p_limit;
$$;
