-- Initial schema for PlanMyNights v1: curated venues, Foursquare fill cache, enquiries.
-- Public visitors can read published venues and areas. Everything else is written
-- server-side with the service role key, never from the browser.

create type venue_type as enum ('restaurant', 'bar', 'club');
create type venue_source as enum ('curated', 'foursquare');
create type enquiry_status as enum ('new', 'contacted', 'confirmed', 'declined');

create table areas (
  slug text primary key,
  name text not null,
  region text not null check (region in ('central', 'east', 'west', 'south', 'north')),
  lat double precision not null,
  lng double precision not null,
  blurb text
);

create table venues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  type venue_type not null,
  area_slug text not null references areas (slug),
  address text,
  lat double precision not null,
  lng double precision not null,
  nearest_tube text,
  price_band smallint check (price_band between 1 and 4),
  price_per_head_gbp integer,
  vibe_tags text[] not null default '{}',
  music_tags text[] not null default '{}',
  cuisine text,
  dress_code text,
  door_policy text,
  booking_url text,
  website_url text,
  instagram_handle text,
  photos text[] not null default '{}',
  description text,
  source venue_source not null default 'curated',
  fsq_id text unique,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index venues_type_area_idx on venues (type, area_slug) where published;
create index venues_vibe_tags_idx on venues using gin (vibe_tags);

-- Real opening hours, one row per opening period. closes < opens means it closes after midnight.
create table venue_hours (
  venue_id uuid not null references venues (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Monday
  opens time not null,
  closes time not null,
  primary key (venue_id, weekday, opens)
);

create table foursquare_cache (
  query_key text primary key,
  response jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

create table enquiries (
  id uuid primary key default gen_random_uuid(),
  plan jsonb not null,
  name text not null,
  email text not null,
  phone text,
  night_date date not null,
  party_size smallint not null check (party_size between 1 and 50),
  notes text,
  status enquiry_status not null default 'new',
  email_sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table areas enable row level security;
alter table venues enable row level security;
alter table venue_hours enable row level security;
alter table foursquare_cache enable row level security;
alter table enquiries enable row level security;

create policy "Areas are public" on areas for select using (true);
create policy "Published venues are public" on venues for select using (published);
create policy "Hours of published venues are public" on venue_hours for select
  using (exists (select 1 from venues v where v.id = venue_id and v.published));
-- foursquare_cache and enquiries have no policies: service role only.
