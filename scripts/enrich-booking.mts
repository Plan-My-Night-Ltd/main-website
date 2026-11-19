// Booking details from Google Maps, through Apify's Google Maps Scraper
// (compass/crawler-google-places): which system each venue takes bookings through,
// whether it takes bookings at all, and Google's "Popular times". What each column
// holds is described in supabase/migrations/20261120000000_booking_enrichment.sql.
//
//   npm run enrich:booking -- --limit 50 --dry-run --save google.json   (look first)
//   npm run enrich:booking -- --from google.json                         (then write, no Apify calls)
//   options: --types restaurant,bar  --areas soho,mayfair (default all)  --batch 25
//            --refresh-days 30 (skip venues checked more recently)  --max-usd 5 (stop spending here)
//
// Google is searched for "<name>, <address>" and the top result is accepted only if
// it's within 150 m and has a similar name. When Google doesn't name the booking
// system, the venue's own homepage (and its "Book" page) is checked for a widget.
// Cost: about $1.50 per 1,000 places plus the detail-page and reservation add-ons,
// so a few dollars for every restaurant in the 30 areas. The run prints what it cost.

import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { detectBooking, platformFromName, type BookingPlatform } from "../src/lib/booking/platforms.ts";

const ACTOR = "compass~crawler-google-places";
const APIFY = "https://api.apify.com/v2";
const MAX_MATCH_KM = 0.15;
const weekdayKeys = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]; // ours: 0 = Monday

const { values: args } = parseArgs({
  options: {
    types: { type: "string", default: "restaurant,bar" },
    areas: { type: "string" },
    limit: { type: "string", default: "50" },
    batch: { type: "string", default: "25" },
    "refresh-days": { type: "string", default: "30" },
    "max-usd": { type: "string", default: "5" },
    save: { type: "string" },
    from: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

const limit = Number(args.limit);
const batchSize = Number(args.batch);
const maxUsd = Number(args["max-usd"]);

// ---------- Venues to check ----------

type VenueRow = {
  id: string;
  slug: string;
  name: string;
  type: string;
  address: string | null;
  lat: number;
  lng: number;
  website_url: string | null;
  booking_url: string | null;
  verified: boolean;
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

async function venuesToCheck(): Promise<VenueRow[]> {
  const cutoff = new Date(Date.now() - Number(args["refresh-days"]) * 86_400_000).toISOString();
  let q = db
    .from("venues")
    .select("id, slug, name, type, address, lat, lng, website_url, booking_url, verified")
    .eq("published", true)
    .in("type", args.types!.split(","))
    .or(`booking_enriched_at.is.null,booking_enriched_at.lt.${cutoff}`)
    .order("verified", { ascending: false })
    .order("rating", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (args.areas) q = q.in("area_slug", args.areas.split(","));
  const { data, error } = await q;
  if (error) throw new Error(`Reading venues: ${error.message}`);
  return data as VenueRow[];
}

// ---------- Apify ----------

type Place = {
  searchString?: string;
  title?: string;
  placeId?: string;
  location?: { lat: number; lng: number };
  permanentlyClosed?: boolean;
  reserveTableUrl?: string | null;
  tableReservationLinks?: { name?: string; url?: string }[];
  bookingLinks?: { name?: string; url?: string }[];
  restaurantData?: { tableReservationProvider?: { name?: string; reserveTableUrl?: string } | null } | null;
  additionalInfo?: Record<string, Record<string, boolean>[]> | null;
  popularTimesHistogram?: Record<string, { hour: number; occupancyPercent: number }[]> | null;
};

let spentUsd = 0;

async function apify(path: string, init?: RequestInit): Promise<unknown> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN isn't set.");
  const res = await fetch(`${APIFY}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`Apify ${res.status} on ${path}: ${await res.text()}`);
  return res.json();
}

type Run = { id: string; status: string; defaultDatasetId: string; usageTotalUsd?: number; chargedEventCounts?: Record<string, number> };

async function searchGoogle(searches: string[]): Promise<Place[]> {
  const input = {
    searchStringsArray: searches,
    locationQuery: "London, United Kingdom",
    maxCrawledPlacesPerSearch: 1,
    language: "en",
    scrapePlaceDetailPage: true,
    scrapeTableReservationProvider: true,
    maxCompetitorsToAnalyze: 0,
    maxReviews: 0,
    maxImages: 0,
    maxQuestions: 0,
  };
  // maxTotalChargeUsd caps what this run can spend on the actor's paid events.
  const capUsd = Math.max(0.5, maxUsd - spentUsd).toFixed(2);
  let run = ((await apify(`/acts/${ACTOR}/runs?maxTotalChargeUsd=${capUsd}`, { method: "POST", body: JSON.stringify(input) })) as { data: Run }).data;
  while (!["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(run.status)) {
    run = ((await apify(`/actor-runs/${run.id}?waitForFinish=60`)) as { data: Run }).data;
  }
  spentUsd += run.usageTotalUsd ?? 0;
  console.log(`  Apify run ${run.id}: ${run.status}, $${(run.usageTotalUsd ?? 0).toFixed(3)}`, run.chargedEventCounts ?? "");
  if (run.status !== "SUCCEEDED") throw new Error(`Apify run ${run.id} ended ${run.status}.`);
  return (await apify(`/datasets/${run.defaultDatasetId}/items?clean=true`)) as Place[];
}

// ---------- Matching and reading a place ----------

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const filler = new Set(["the", "and", "restaurant", "bar", "london", "kitchen", "cafe", "club", "soho", "mayfair"]);
function words(name: string): Set<string> {
  return new Set(
    name
      .normalize("NFKD")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w && !filler.has(w)),
  );
}

// Same place if most of the shorter name's words are in the other ("Dishoom" vs "Dishoom Covent Garden").
function similarNames(a: string, b: string): boolean {
  const [x, y] = [words(a), words(b)];
  const [small, big] = x.size <= y.size ? [x, y] : [y, x];
  if (small.size === 0) return a.trim().toLowerCase() === b.trim().toLowerCase();
  return [...small].filter((w) => big.has(w)).length / small.size >= 0.6;
}

function searchFor(v: VenueRow): string {
  return v.address ? `${v.name}, ${v.address}` : v.name;
}

function acceptsReservations(p: Place): boolean | null {
  for (const item of p.additionalInfo?.Planning ?? []) {
    if ("Accepts reservations" in item) return item["Accepts reservations"];
    if (item["Reservations required"]) return true;
  }
  return null;
}

// Google's histogram, Monday first, as 7 x 24 percentages with null for hours it doesn't show.
function popularTimes(p: Place): (number | null)[][] | null {
  const h = p.popularTimesHistogram;
  if (!h || Object.keys(h).length === 0) return null;
  return weekdayKeys.map((key) => {
    const hours: (number | null)[] = Array(24).fill(null);
    for (const { hour, occupancyPercent } of h[key] ?? []) if (hour >= 0 && hour < 24) hours[hour] = occupancyPercent;
    return hours;
  });
}

// ---------- The venue's own website ----------

async function fetchText(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PlanMyNightsBot/1.0)", Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

// The homepage, then the first same-site link that looks like a booking page.
async function bookingFromWebsite(site: string) {
  const home = await fetchText(site);
  if (!home) return null;
  const found = detectBooking(home);
  if (found) return found;
  const link = /href=["']([^"'#]*(?:book|reserv)[^"'#]*)["']/i.exec(home)?.[1];
  if (!link) return null;
  try {
    const next = new URL(link, site);
    if (next.hostname !== new URL(site).hostname) return detectBooking(next.toString());
    const page = await fetchText(next.toString());
    return page ? detectBooking(page) : null;
  } catch {
    return null;
  }
}

// ---------- Run ----------

type Update = {
  google_place_id: string | null;
  booking_platform: BookingPlatform | null;
  booking_platform_id: string | null;
  booking_url?: string;
  accepts_reservations: boolean | null;
  popular_times: (number | null)[][] | null;
  booking_enriched_at: string;
};

const venues = await venuesToCheck();
console.log(`${venues.length} venues to check.`);

let places: Place[] = [];
if (args.from) {
  places = JSON.parse(readFileSync(args.from, "utf8")) as Place[];
  console.log(`Loaded ${places.length} Google places from ${args.from}; no Apify calls made.`);
} else {
  for (let i = 0; i < venues.length; i += batchSize) {
    if (spentUsd >= maxUsd) {
      console.warn(`Stopped at --max-usd ${maxUsd}; ${venues.length - i} venues not checked.`);
      break;
    }
    console.log(`Searching Google for venues ${i + 1} to ${Math.min(i + batchSize, venues.length)}...`);
    places.push(...(await searchGoogle(venues.slice(i, i + batchSize).map(searchFor))));
  }
  if (args.save) {
    writeFileSync(args.save, JSON.stringify(places));
    console.log(`Saved ${places.length} places to ${args.save}`);
  }
}

const bySearch = new Map(places.filter((p) => p.searchString).map((p) => [p.searchString!.trim().toLowerCase(), p]));
const now = new Date().toISOString();
const updates: { venue: VenueRow; update: Update; note: string }[] = [];
const counts = { matched: 0, unmatched: 0, notSearched: 0, closed: 0, fromWebsite: 0, popularTimes: 0, walkIns: 0 };
const byPlatform: Record<string, number> = {};

for (const v of venues) {
  const place = bySearch.get(searchFor(v).trim().toLowerCase());
  if (!place) {
    // Not searched this run (budget, or --from a file of other venues): left for next time.
    counts.notSearched++;
    continue;
  }
  const near = place.location ? km(v, place.location) : Infinity;
  const matched = near <= MAX_MATCH_KM && similarNames(v.name, place.title ?? "");
  const update: Update = {
    google_place_id: null,
    booking_platform: null,
    booking_platform_id: null,
    accepts_reservations: null,
    popular_times: null,
    booking_enriched_at: now,
  };
  if (!matched) {
    counts.unmatched++;
    console.log(`  No match: ${v.name} -> ${place.title ?? "nothing"} (${Number.isFinite(near) ? `${Math.round(near * 1000)} m` : "no location"})`);
    // Stamped anyway so the next run doesn't pay to search it again.
    updates.push({ venue: v, update, note: "unmatched" });
    continue;
  }
  counts.matched++;
  if (place.permanentlyClosed) {
    counts.closed++;
    console.warn(`  Google says ${v.name} has closed permanently. Review it by hand.`);
  }

  // Direct platform links first: Google's own "Reserve a table" link can't be pre-filled.
  const links = [...(place.tableReservationLinks ?? []), ...(place.bookingLinks ?? [])].map((l) => l.url).filter((u): u is string => Boolean(u));
  const provider = place.restaurantData?.tableReservationProvider;
  let detected = links.map(detectBooking).find((d) => d !== null) ?? null;
  if (!detected && v.website_url && !provider?.name) {
    detected = await bookingFromWebsite(v.website_url);
    if (detected) counts.fromWebsite++;
  }

  update.google_place_id = place.placeId ?? null;
  update.booking_platform = detected?.platform ?? platformFromName(provider?.name);
  update.booking_platform_id = detected?.id ?? null;
  const bookingUrl = detected?.url ?? links[0] ?? provider?.reserveTableUrl ?? place.reserveTableUrl ?? undefined;
  // A booking link someone checked by hand stays as it is.
  if (bookingUrl && !(v.verified && v.booking_url)) update.booking_url = bookingUrl;
  update.accepts_reservations = acceptsReservations(place) ?? (update.booking_platform ? true : null);
  update.popular_times = popularTimes(place);

  if (update.popular_times) counts.popularTimes++;
  if (update.accepts_reservations === false) counts.walkIns++;
  const key = update.booking_platform ?? (update.accepts_reservations === false ? "walk-ins" : "unknown");
  byPlatform[key] = (byPlatform[key] ?? 0) + 1;
  updates.push({ venue: v, update, note: key });
}

console.log(
  `\nMatched ${counts.matched}, no match ${counts.unmatched}, not searched ${counts.notSearched}. ` +
    `Closed on Google: ${counts.closed}. Platform found on the venue's website: ${counts.fromWebsite}. ` +
    `With popular times: ${counts.popularTimes}.`,
);
console.log(`Booking: ${Object.entries(byPlatform).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ") || "none"}`);
if (!args.from) console.log(`Apify: about $${spentUsd.toFixed(2)} (platform usage; paid events are listed per run above).`);

if (args["dry-run"]) {
  for (const { venue, update, note } of updates.slice(0, 25)) {
    console.log(`  ${venue.name}: ${note}${update.booking_platform_id ? ` (${update.booking_platform_id})` : ""} ${update.booking_url ?? ""}`);
  }
  console.log("\nDry run: nothing written to the database.");
  process.exit(0);
}

let written = 0;
for (const { venue, update } of updates) {
  const { error } = await db.from("venues").update(update).eq("id", venue.id);
  if (error) {
    // Two venue rows matching the same Google place breaks the unique place id: keep the rest.
    if (error.code === "23505") {
      console.warn(`  ${venue.name} matched a Google place another venue already has; saved without the place id.`);
      const { error: again } = await db.from("venues").update({ ...update, google_place_id: null }).eq("id", venue.id);
      if (again) throw new Error(`Updating ${venue.name}: ${again.message}`);
    } else {
      throw new Error(`Updating ${venue.name}: ${error.message}`);
    }
  }
  written++;
}
console.log(`\nDatabase: ${written} venues updated.`);
