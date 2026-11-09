import { cache } from "react";
import { areas } from "@/lib/data/areas";
import { sampleVenues } from "@/lib/data/sample-venues";
import { weekdayOf } from "@/lib/format";
import type { Answers } from "@/lib/plan/answers";
import { areaRadiusKm, maxHopKm, stopVenueType } from "@/lib/plan/build";
import { authConfigured } from "@/lib/supabase/env";
import { publicSupabase } from "@/lib/supabase/public";
import type { Area, Venue, VenueType } from "@/lib/types";

// Data access for pages. Areas are fixed and live in code; venues come from
// Supabase, or from the local sample data when Supabase isn't configured.

export const usingSampleData = !authConfigured;

export function listAreas(): Area[] {
  return areas;
}

export function getArea(slug: string): Area | undefined {
  return areas.find((a) => a.slug === slug);
}

const listColumns =
  "slug, name, type, area_slug, address, lat, lng, nearest_tube, price_band, price_per_head_gbp, vibe_tags, auto_vibe_tags, music_tags, auto_music_tags, cuisine, fsq_categories, dress_code, door_policy, booking_url, description, rating, verified, source";

type VenueRow = {
  slug: string;
  name: string;
  type: VenueType;
  area_slug: string;
  address: string | null;
  lat: number;
  lng: number;
  nearest_tube: string | null;
  price_band: 1 | 2 | 3 | 4 | null;
  price_per_head_gbp: number | null;
  vibe_tags: string[];
  auto_vibe_tags: string[];
  music_tags: string[];
  auto_music_tags: string[];
  cuisine: string | null;
  fsq_categories: string[];
  dress_code: string | null;
  door_policy: string | null;
  booking_url: string | null;
  description: string | null;
  rating: number | null;
  verified: boolean;
  source: "curated" | "foursquare";
  venue_hours?: { weekday: number; opens: string; closes: string }[];
};

function db() {
  const client = publicSupabase();
  if (!client) throw new Error("Supabase isn't configured.");
  return client;
}

function fail(what: string, error: { message: string }): never {
  throw new Error(`Couldn't load ${what} from Supabase: ${error.message}`);
}

export const getVenue = cache(async (slug: string): Promise<Venue | undefined> => {
  if (usingSampleData) return sampleVenues.find((v) => v.slug === slug);
  const { data, error } = await db()
    .from("venues")
    .select(`${listColumns}, venue_hours (weekday, opens, closes)`)
    .eq("slug", slug)
    .maybeSingle<VenueRow>();
  if (error) fail("venue", error);
  return data ? toVenue(data) : undefined;
});

export async function getVenuesBySlugs(slugs: string[]): Promise<Venue[]> {
  if (usingSampleData) return sampleVenues.filter((v) => slugs.includes(v.slug));
  if (slugs.length === 0) return [];
  const { data, error } = await db().from("venues").select(listColumns).in("slug", slugs).overrideTypes<VenueRow[], { merge: false }>();
  if (error) fail("venues", error);
  return data.map(toVenue);
}

/** Best-first: checked venues, then by Foursquare rating. Hours aren't included. */
export async function venuesInArea(areaSlug: string, perType = 12): Promise<Venue[]> {
  if (usingSampleData) return sampleVenues.filter((v) => v.areaSlug === areaSlug);
  const types: VenueType[] = ["restaurant", "bar", "club"];
  const lists = await Promise.all(
    types.map(async (type) => {
      const { data, error } = await db()
        .from("venues")
        .select(listColumns)
        .eq("area_slug", areaSlug)
        .eq("type", type)
        .order("verified", { ascending: false })
        .order("rating", { ascending: false, nullsFirst: false })
        .order("name")
        .limit(perType)
        .overrideTypes<VenueRow[], { merge: false }>();
      if (error) fail("venues", error);
      return data.map(toVenue);
    }),
  );
  return lists.flat();
}

export async function venueCountsByArea(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (usingSampleData) {
    for (const v of sampleVenues) counts.set(v.areaSlug, (counts.get(v.areaSlug) ?? 0) + 1);
    return counts;
  }
  const { data, error } = await db().from("area_venue_counts").select("area_slug, venues");
  if (error) fail("venue counts", error);
  for (const row of data) counts.set(row.area_slug, row.venues);
  return counts;
}

// Each later stop can be up to maxHopKm from the one before, so a three-stop
// night can end this far from the chosen area's centre.
const candidatesPerStop = 100;

/** Shortlist for buildPlan: the best venues for each stop out of everything in the database. */
export async function planCandidates(answers: Answers): Promise<Venue[]> {
  if (usingSampleData) return sampleVenues;
  const weekday = weekdayOf(answers.date);
  const centre = getArea(answers.area);
  const region = answers.area.startsWith("region:") ? answers.area.slice("region:".length) : null;
  const where = centre
    ? { p_lat: centre.lat, p_lng: centre.lng, p_radius_km: areaRadiusKm + maxHopKm * (answers.stops.length - 1) }
    : region
      ? { p_area_slugs: areas.filter((a) => a.region === region).map((a) => a.slug) }
      : {};

  const lists = await Promise.all(
    answers.stops.map(async (stop) => {
      const { data, error } = await db()
        .rpc("plan_candidates", {
          p_type: stopVenueType[stop],
          p_weekday: weekday,
          p_budget: answers.budget,
          p_vibes: answers.vibes,
          p_music: stop === "dinner" || answers.music === "any" ? null : answers.music,
          p_limit: candidatesPerStop,
          ...where,
        })
        .select(`${listColumns}, venue_hours (weekday, opens, closes)`);
      if (error) fail("plan candidates", error);
      // Untyped client: the function's rows come back as unknown, so cast here.
      return (data as VenueRow[]).map(toVenue);
    }),
  );
  return lists.flat();
}

function toVenue(r: VenueRow): Venue {
  return {
    slug: r.slug,
    name: r.name,
    type: r.type,
    areaSlug: r.area_slug,
    address: r.address ?? "",
    lat: r.lat,
    lng: r.lng,
    nearestTube: r.nearest_tube ?? undefined,
    priceBand: r.price_band ?? undefined,
    pricePerHeadGbp: r.price_per_head_gbp ?? undefined,
    vibeTags: [...new Set([...r.vibe_tags, ...r.auto_vibe_tags])],
    musicTags: [...new Set([...r.music_tags, ...r.auto_music_tags])],
    cuisine: r.cuisine ?? (r.type === "restaurant" ? cuisineFrom(r.fsq_categories) : undefined),
    dressCode: r.dress_code ?? undefined,
    doorPolicy: r.door_policy ?? undefined,
    bookingUrl: r.booking_url ?? undefined,
    description: r.description ?? describeFromCategories(r),
    rating: r.rating ?? undefined,
    verified: r.verified,
    source: r.source,
    hours: (r.venue_hours ?? []).map((h) => ({ weekday: h.weekday, opens: h.opens.slice(0, 5), closes: h.closes.slice(0, 5) })),
  };
}

// "Italian Restaurant" -> "Italian". Plain "Restaurant" says nothing, so it's dropped.
function cuisineFrom(categories: string[]): string | undefined {
  const c = categories[0]?.replace(/ Restaurant$/, "");
  return c && c !== "Restaurant" ? c : undefined;
}

const genericWords = /\b(Bar|Restaurant|Pub|Club|Night|Lounge|Speakeasy|Joint|Spot|Place|Steakhouse|Pizzeria|Brasserie|Bistro|Gastropub|Diner|Grill|Cocktail|Wine|Beer|Hotel|Gay|Sports|Dive|Karaoke|Piano|Rooftop|Music|Venue|Jazz|Blues|Live)\b/g;

// Until someone writes a description: "Cocktail bar and speakeasy in Soho."
function describeFromCategories(r: VenueRow): string {
  const kinds = r.fsq_categories.slice(0, 2).map((c) => c.replace(genericWords, (w) => w.toLowerCase()));
  const area = getArea(r.area_slug)?.name ?? "London";
  if (kinds.length === 0) return `In ${area}.`;
  const text = `${kinds.join(" and ")} in ${area}.`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
