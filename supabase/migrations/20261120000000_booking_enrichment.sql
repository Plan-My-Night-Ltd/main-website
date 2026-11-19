-- Booking details from Google Maps (scripts/enrich-booking.mts, via Apify's Google
-- Maps Scraper): which system a venue takes bookings through, whether it takes them
-- at all, and how busy it usually is. The Foursquare import never writes these.
--
-- booking_platform_id is the venue's id on that platform, in the form the platform
-- uses in its own URLs: an OpenTable slug or numeric rid, a SevenRooms venue slug,
-- "<city>/<slug>" on Resy, "<name>/<id>" on ResDiary. It's what an official
-- availability API (OpenTable affiliate, TheFork B2B, ResDiary) would be keyed on.
--
-- popular_times is Google's "Popular times": 7 arrays (Monday first) of 24 hourly
-- occupancy percentages, null where Google has nothing for that hour.

alter table venues
  add column google_place_id text unique,
  add column booking_platform text check (
    booking_platform in ('opentable', 'sevenrooms', 'resy', 'resdiary', 'designmynight', 'thefork', 'tock', 'other')
  ),
  add column booking_platform_id text,
  add column accepts_reservations boolean,
  add column popular_times jsonb,
  add column booking_enriched_at timestamptz;
