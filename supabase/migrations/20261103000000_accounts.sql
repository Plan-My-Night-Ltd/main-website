-- Accounts: Google and email sign-in via Supabase Auth, plus each person's saved
-- plans (previous searches) and the places they've been. Every row belongs to one
-- user, and row level security means people can only ever see their own.

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Create a profile for every new account. Google fills full_name and avatar_url;
-- the email sign-up form sends full_name.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- One row per search. Swapping a venue updates the same row (same search_key)
-- rather than adding a new one; plan_key is the latest shareable plan id.
create table saved_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  search_key text not null,
  plan_key text not null,
  answers jsonb not null,
  night_date date not null,
  area text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, search_key)
);

create index saved_plans_user_recent_idx on saved_plans (user_id, updated_at desc);

-- Places a person has been. Marked by the guest for now; confirmed bookings can
-- add rows with source 'booking' once enquiries are linked to accounts.
create table visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  venue_slug text not null references venues (slug) on update cascade on delete cascade,
  visited_on date not null default current_date,
  source text not null default 'marked' check (source in ('marked', 'booking')),
  created_at timestamptz not null default now(),
  unique (user_id, venue_slug)
);

create index visits_user_recent_idx on visits (user_id, visited_on desc);

-- Booking requests from signed-in guests are linked to their account.
alter table enquiries add column user_id uuid references auth.users (id) on delete set null;

alter table profiles enable row level security;
alter table saved_plans enable row level security;
alter table visits enable row level security;

create policy "People read their own profile" on profiles for select using ((select auth.uid()) = id);
create policy "People update their own profile" on profiles for update using ((select auth.uid()) = id);

create policy "People read their own plans" on saved_plans for select using ((select auth.uid()) = user_id);
create policy "People add their own plans" on saved_plans for insert with check ((select auth.uid()) = user_id);
create policy "People update their own plans" on saved_plans for update using ((select auth.uid()) = user_id);
create policy "People delete their own plans" on saved_plans for delete using ((select auth.uid()) = user_id);

create policy "People read their own visits" on visits for select using ((select auth.uid()) = user_id);
create policy "People add their own visits" on visits for insert with check ((select auth.uid()) = user_id);
create policy "People delete their own visits" on visits for delete using ((select auth.uid()) = user_id);
