import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/admin";
import type { BookingPlatform } from "@/lib/booking/platforms";
import type { Answers, Stop } from "@/lib/plan/answers";
import { serverSupabase } from "@/lib/supabase/server";
import type { VenueType } from "@/lib/types";

// Everything the Control Center reads comes from the admin_* functions in
// supabase/migrations/20261125000100_control_center.sql. They check the caller is
// the admin themselves, so this file's checks only decide what to render.

/**
 * The signed-in person's email from their session token, or null when signed out.
 * getClaims() checks the token's signature locally rather than asking Supabase
 * Auth over the network (proxy.ts has already refreshed it), which saves a round
 * trip on every Control Center load. It's safe to rely on here because the
 * admin_* functions check the account again in the database.
 */
export async function sessionEmail(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email;
  return data?.claims ? (typeof email === "string" ? email : "") : null;
}

/** The signed-in admin's Supabase client. Signed out: to sign in. Anyone else: a plain 404. */
export async function requireAdmin(next = "/control-center"): Promise<SupabaseClient> {
  const supabase = await serverSupabase();
  const email = supabase ? await sessionEmail(supabase) : null;
  if (!supabase || email === null) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!isAdminEmail(email)) notFound();
  return supabase;
}

export type Result<T> = { data: T; error: null } | { data: null; error: string };

export async function call<T>(supabase: SupabaseClient, fn: string, args?: Record<string, unknown>): Promise<Result<T>> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { data: null, error: error.message };
  return { data: data as T, error: null };
}

// --- Time range ----------------------------------------------------------------

export const ranges = [
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "all", label: "All time", days: null },
] as const;

export type RangeKey = (typeof ranges)[number]["key"];

export function parseRange(value: string | string[] | undefined): RangeKey {
  return ranges.some((r) => r.key === value) ? (value as RangeKey) : "30";
}

/** Start of the range as an ISO timestamp, or null for all time. */
export function sinceFor(range: RangeKey): string | null {
  const days = ranges.find((r) => r.key === range)!.days;
  return days === null ? null : new Date(Date.now() - days * 86_400_000).toISOString();
}

// --- Shapes returned by the admin_* functions ----------------------------------

export type Count = { key: string; n: number };

export type Overview = {
  users_total: number;
  users_new: number;
  opted_in: number;
  providers: Record<string, number>;
  searches: number;
  nights_planned: number;
  searchers: number;
  active_users: number;
  returning_active: number;
  returning_total: number;
  ever_active: number;
  clicks: number;
  booking_clicks: number;
  clickers: number;
  anonymous_clicks: number;
  bookings: number;
  covers: number;
  bookers: number;
  upcoming_bookings: number;
  series: { day: string; signups: number; searches: number; clicks: number; bookings: number }[];
};

export type AdminUser = {
  id: string;
  name: string | null;
  email: string | null;
  provider: string;
  signed_up_at: string;
  last_sign_in_at: string | null;
  confirmed: boolean;
  marketing_opt_in: boolean | null;
  searches: number;
  nights_planned: number;
  days_active: number;
  returned: boolean;
  last_active_on: string | null;
  usual_area: string | null;
  usual_budget: number | null;
  usual_group: string | null;
  avg_party_size: number | null;
  clicks: number;
  bookings: number;
};

export type AdminUserDetail = Omit<
  AdminUser,
  "searches" | "nights_planned" | "returned" | "last_active_on" | "usual_area" | "usual_budget" | "usual_group" | "avg_party_size" | "clicks" | "bookings"
> & {
  marketing_opt_in_at: string | null;
  searches: { plan_key: string; answers: Answers; night_date: string; created_at: string; updated_at: string }[];
  bookings: {
    venue_slug: string;
    venue: string | null;
    venue_type: VenueType | null;
    area: string | null;
    night_date: string;
    stop: Stop | null;
    party_size: number | null;
    created_at: string;
  }[];
  clicks: {
    venue_slug: string;
    venue: string | null;
    kind: ClickKind;
    platform: BookingPlatform | null;
    source: ClickSource;
    night_date: string | null;
    created_at: string;
  }[];
  visits: { venue_slug: string; venue: string | null; visited_on: string }[];
};

export type Preferences = {
  total: number;
  group: Count[];
  budget: Count[];
  shape: Count[];
  vibes: Count[];
  music: Count[];
  area: Count[];
  party: Count[];
  start: Count[];
  weekday: Count[];
  lead: Count[];
};

export type ClickKind = "book" | "website" | "maps";
export type ClickSource = "plan" | "plan_time" | "venue";

export type Traffic = {
  clicks: number;
  bookings: number;
  destinations: { key: string; clicks: number; people: number; bookings: number }[];
  sources: Count[];
  stops: { key: string; clicks: number }[];
  areas: { key: string; clicks: number; bookings: number }[];
  venues: {
    slug: string;
    name: string;
    type: VenueType;
    area: string;
    platform: BookingPlatform | null;
    clicks: number;
    book_clicks: number;
    people: number;
    bookings: number;
    covers: number;
  }[];
};

export type BookingRow = {
  user_id: string;
  name: string | null;
  email: string | null;
  venue_slug: string;
  venue: string | null;
  venue_type: VenueType | null;
  area: string | null;
  platform: BookingPlatform | null;
  night_date: string;
  stop: Stop | null;
  party_size: number | null;
  created_at: string;
  after_click: boolean;
  answers: Answers | null;
};

export type Bookings = {
  total: number;
  covers: number;
  people: number;
  upcoming: number;
  after_click: number;
  by_stop: Count[];
  by_type: Count[];
  list: BookingRow[];
};

export type Catalogue = {
  total: number;
  published: number;
  verified: number;
  with_booking_url: number;
  with_website: number;
  walk_ins_only: number;
  enriched: number;
  with_hours: number;
  last_import: string | null;
  by_type: Partial<Record<VenueType, number>>;
  by_platform: Count[];
  by_area: { key: string; n: number; verified: number }[];
};
