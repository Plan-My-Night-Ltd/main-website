// Booking details for each venue: which system it takes bookings through, the
// exact booking page for that branch, and whether it takes bookings at all. What
// each column holds is described in supabase/migrations/20261120000000_booking_enrichment.sql.
//
//   npm run enrich:booking -- --dry-run                 (look first; nothing written)
//   npm run enrich:booking                              (website pass, then Google for the rest)
//   options: --source website|google|both (default both)  --types restaurant,bar (default restaurant)
//            --areas soho,mayfair  --limit 2000  --max-usd 2 (Apify spend cap)  --concurrency 8
//            --save google.json / --from google.json  (keep or reuse what Google returned)
//
// 1. Website pass (free): the venue's own site and its "Book" page are searched for
//    an OpenTable, SevenRooms, Resy, ResDiary, Tock, TheFork or DesignMyNight link.
//    A chain's site lists every branch, so the link whose id matches the venue's
//    name, area and address is used, and none at all when that's unclear.
// 2. Google pass (Apify's Google Maps Scraper, about $0.005 a venue): only for
//    venues the website pass couldn't settle and Google hasn't been asked about,
//    sites that wouldn't load first. A match must be within 150 m with a similar
//    name. Also records walk-in only venues and Google's "Popular times".

import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { areas } from "../src/lib/data/areas.ts";
import {
  cleanBookingUrl,
  detectAllBookings,
  detectBooking,
  pickBranch,
  platformFromName,
  type BookingPlatform,
  type DetectedBooking,
} from "../src/lib/booking/platforms.ts";

const ACTOR = "compass~crawler-google-places";
const APIFY = "https://api.apify.com/v2";
const MAX_MATCH_KM = 0.15;
const weekdayKeys = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]; // ours: 0 = Monday

const { values: args } = parseArgs({
  options: {
    source: { type: "string", default: "both" },
    types: { type: "string", default: "restaurant" },
    areas: { type: "string" },
    limit: { type: "string", default: "2000" },
    batch: { type: "string", default: "25" },
    "max-usd": { type: "string", default: "2" },
    concurrency: { type: "string", default: "8" },
    save: { type: "string" },
    from: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

const limit = Number(args.limit);
const batchSize = Number(args.batch);
const maxUsd = Number(args["max-usd"]);
const concurrency = Number(args.concurrency);
const source = args.source!;
if (!["website", "google", "both"].includes(source)) throw new Error("--source must be website, google or both");

// ---------- Venues to check ----------

type VenueRow = {
  id: string;
  slug: string;
  name: string;
  type: string;
  address: string | null;
  lat: number;
  lng: number;
  area_slug: string;
  website_url: string | null;
  booking_url: string | null;
  booking_enriched_at: string | null;
  verified: boolean;
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

// Everything without a branch-specific booking id yet: that's what makes the Book
// button pre-fillable. Walk-in only venues are left alone.
async function venuesToCheck(): Promise<VenueRow[]> {
  const rows: VenueRow[] = [];
  for (let from = 0; rows.length < limit; from += 1000) {
    let q = db
      .from("venues")
      .select("id, slug, name, type, address, lat, lng, area_slug, website_url, booking_url, booking_enriched_at, verified")
      .eq("published", true)
      .in("type", args.types!.split(","))
      .is("booking_platform_id", null)
      .or("accepts_reservations.is.null,accepts_reservations.eq.true")
      .order("verified", { ascending: false })
      .order("rating", { ascending: false, nullsFirst: false })
      .order("id")
      .range(from, from + 999);
    if (args.areas) q = q.in("area_slug", args.areas.split(","));
    const { data, error } = await q;
    if (error) throw new Error(`Reading venues: ${error.message}`);
    rows.push(...(data as VenueRow[]));
    if (data.length < 1000) break;
  }
  return rows.slice(0, limit);
}

function areaName(v: VenueRow): string | undefined {
  return areas.find((a) => a.slug === v.area_slug)?.name;
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
  // Long runs see the odd dropped connection; retry those and Apify's 5xx/429s.
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${APIFY}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
      });
      if (res.ok) return await res.json();
      if ((res.status < 500 && res.status !== 429) || attempt >= 4) throw new Error(`Apify ${res.status} on ${path}: ${await res.text()}`);
    } catch (e) {
      if (attempt >= 4 || (e instanceof Error && e.message.startsWith("Apify "))) throw e;
    }
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
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

function isHomepage(link: string): boolean {
  try {
    return new URL(link).pathname.replace(/\/+$/, "") === "";
  } catch {
    return true;
  }
}

// ---------- The venue's own website ----------

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

async function fetchText(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

type SiteResult =
  | { kind: "found"; booking: DetectedBooking }
  | { kind: "ambiguous"; candidates: number }
  | { kind: "none" } // the site loaded but has no booking widget we know
  | { kind: "failed" }; // the site wouldn't load

function choose(found: DetectedBooking[], v: VenueRow): SiteResult | null {
  if (found.length === 0) return null;
  const booking = pickBranch(found, { name: v.name, area: areaName(v), address: v.address });
  return booking ? { kind: "found", booking } : { kind: "ambiguous", candidates: found.length };
}

// A page, then up to three same-site links that look like booking pages.
async function bookingFromSite(pageUrl: string, v: VenueRow): Promise<SiteResult> {
  const home = await fetchText(pageUrl);
  if (!home) return { kind: "failed" };
  const direct = choose(detectAllBookings(home), v);
  if (direct) return direct;
  const links = [...home.matchAll(/href=["']([^"'#]*(?:book|reserv|table)[^"'#]*)["']/gi)].map((m) => m[1]);
  for (const link of [...new Set(links)].slice(0, 3)) {
    try {
      const next = new URL(link, pageUrl);
      const fromLink = choose(detectAllBookings(next.toString()), v);
      if (fromLink) return fromLink;
      if (next.hostname !== new URL(pageUrl).hostname) continue;
      const page = await fetchText(next.toString());
      const fromPage = page ? choose(detectAllBookings(page), v) : null;
      if (fromPage) return fromPage;
    } catch {
      // not a usable link
    }
  }
  return { kind: "none" };
}

async function inParallel<T>(items: T[], n: number, work: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) await work(items[next++]);
  }));
}

// ---------- Run ----------

type Update = {
  google_place_id?: string | null;
  booking_platform: BookingPlatform | null;
  booking_platform_id: string | null;
  booking_url?: string;
  accepts_reservations: boolean | null;
  popular_times?: (number | null)[][] | null;
  booking_enriched_at: string;
};

const venues = await venuesToCheck();
const now = new Date().toISOString();
const updates = new Map<string, { venue: VenueRow; update: Update; note: string }>();
console.log(`${venues.length} venues without a branch booking link yet.`);

function save(v: VenueRow, update: Update, note: string) {
  // A booking link someone checked by hand stays as it is.
  if (update.booking_url && v.verified && v.booking_url) delete update.booking_url;
  else if (update.booking_url) update.booking_url = cleanBookingUrl(update.booking_url);
  updates.set(v.id, { venue: v, update, note });
}

// 1. Website pass
const siteResult = new Map<string, SiteResult["kind"]>();
if (source !== "google") {
  const withSites = venues.filter((v) => v.website_url);
  console.log(`\nWebsite pass: ${withSites.length} sites...`);
  let done = 0;
  await inParallel(withSites, concurrency, async (v) => {
    const r = await bookingFromSite(v.website_url!, v);
    siteResult.set(v.id, r.kind);
    if (r.kind === "found") {
      const b = r.booking;
      save(v, { booking_platform: b.platform, booking_platform_id: b.id, booking_url: b.url, accepts_reservations: true, booking_enriched_at: now }, `website ${b.platform}`);
    } else if (r.kind === "ambiguous") {
      console.log(`  ${v.name} (${areaName(v)}): ${r.candidates} branches on the site, none clearly this one`);
    }
    if (++done % 100 === 0) console.log(`  ${done} sites checked`);
  });
  const tally: Record<string, number> = {};
  for (const k of siteResult.values()) tally[k] = (tally[k] ?? 0) + 1;
  console.log(`Website pass: ${Object.entries(tally).map(([k, n]) => `${k} ${n}`).join(", ")}`);
}

// 2. Google pass: venues still unsettled that Google hasn't been asked about,
// sites that wouldn't load first (they're the likeliest to have a widget we missed).
const rank = { failed: 0, ambiguous: 1, none: 2 } as Record<string, number>;
const forGoogle =
  source === "website"
    ? []
    : venues
        .filter((v) => !updates.has(v.id) && !v.booking_enriched_at)
        .sort((a, b) => (rank[siteResult.get(a.id) ?? "failed"] ?? 0) - (rank[siteResult.get(b.id) ?? "failed"] ?? 0));

let places: Place[] = [];
if (forGoogle.length > 0) {
  if (args.from) {
    places = JSON.parse(readFileSync(args.from, "utf8")) as Place[];
    console.log(`\nLoaded ${places.length} Google places from ${args.from}; no Apify calls made.`);
  } else {
    console.log(`\nGoogle pass: up to ${forGoogle.length} venues, capped at $${maxUsd}...`);
    for (let i = 0; i < forGoogle.length; i += batchSize) {
      if (spentUsd >= maxUsd) {
        console.warn(`Stopped at --max-usd ${maxUsd}; ${forGoogle.length - i} venues left for another run.`);
        break;
      }
      places.push(...(await searchGoogle(forGoogle.slice(i, i + batchSize).map(searchFor))));
      // Saved after every batch, so a failure later never means paying for these again.
      if (args.save) writeFileSync(args.save, JSON.stringify(places));
    }
    if (args.save) console.log(`Saved ${places.length} places to ${args.save}`);
  }
}

const bySearch = new Map(places.filter((p) => p.searchString).map((p) => [p.searchString!.trim().toLowerCase(), p]));
const counts = { matched: 0, unmatched: 0, closed: 0, branchPage: 0 };

for (const v of forGoogle) {
  const place = bySearch.get(searchFor(v).trim().toLowerCase());
  if (!place) continue; // not searched this run
  const near = place.location ? km(v, place.location) : Infinity;
  const empty: Update = { google_place_id: null, booking_platform: null, booking_platform_id: null, accepts_reservations: null, popular_times: null, booking_enriched_at: now };
  if (!(near <= MAX_MATCH_KM && similarNames(v.name, place.title ?? ""))) {
    counts.unmatched++;
    console.log(`  No match: ${v.name} -> ${place.title ?? "nothing"} (${Number.isFinite(near) ? `${Math.round(near * 1000)} m` : "no location"})`);
    // Stamped anyway so the next run doesn't pay to search it again.
    save(v, empty, "unmatched");
    continue;
  }
  counts.matched++;
  if (place.permanentlyClosed) {
    counts.closed++;
    console.warn(`  Google says ${v.name} has closed permanently. Review it by hand.`);
  }

  const links = [...(place.tableReservationLinks ?? []), ...(place.bookingLinks ?? [])]
    .map((l) => l.url)
    .filter((u): u is string => Boolean(u));
  const provider = place.restaurantData?.tableReservationProvider;
  const pageLinks = links.filter((l) => !isHomepage(l));
  // A platform link from Google is for this branch. Failing that, the restaurant's
  // own booking page Google points to usually embeds the branch's widget.
  let detected = links.map(detectBooking).find((d) => d !== null) ?? null;
  if (!detected && pageLinks[0]) {
    const r = await bookingFromSite(pageLinks[0], v);
    if (r.kind === "found") {
      detected = r.booking;
      counts.branchPage++;
    }
  }

  const update: Update = { ...empty, google_place_id: place.placeId ?? null, popular_times: popularTimes(place) };
  update.booking_platform = detected?.platform ?? platformFromName(provider?.name);
  update.booking_platform_id = detected?.id ?? null;
  update.accepts_reservations = acceptsReservations(place) ?? (update.booking_platform ? true : null);
  // A walk-in venue's "reservation" link is usually a page saying it doesn't take them.
  update.booking_url =
    detected?.url ??
    (update.accepts_reservations === false && !update.booking_platform
      ? undefined
      : (pageLinks[0] ?? provider?.reserveTableUrl ?? place.reserveTableUrl ?? undefined));
  const note = update.booking_platform ?? (update.accepts_reservations === false ? "walk-ins" : "unknown");
  save(v, update, `google ${note}${detected ? "" : update.booking_platform ? " (no branch link)" : ""}`);
}

if (forGoogle.length > 0) {
  console.log(`Google pass: matched ${counts.matched}, no match ${counts.unmatched}, closed ${counts.closed}, branch found on their booking page ${counts.branchPage}.`);
  if (!args.from) console.log(`Apify: about $${spentUsd.toFixed(2)}.`);
}

const tally: Record<string, number> = {};
for (const { note } of updates.values()) tally[note] = (tally[note] ?? 0) + 1;
const prefillable = [...updates.values()].filter((u) => u.update.booking_platform_id).length;
console.log(`\nResult: ${prefillable} of ${venues.length} now have a branch booking link.`);
console.log(Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, n]) => `  ${k}: ${n}`).join("\n"));

if (args["dry-run"]) {
  for (const { venue, update, note } of [...updates.values()].slice(0, 30)) {
    console.log(`  ${venue.name} (${areaName(venue)}): ${note} ${update.booking_platform_id ?? ""} ${update.booking_url ?? ""}`);
  }
  console.log("\nDry run: nothing written to the database.");
  process.exit(0);
}

let written = 0;
for (const { venue, update } of updates.values()) {
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
