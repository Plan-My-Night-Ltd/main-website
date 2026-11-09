// Monthly Foursquare import: the best-rated restaurants, bars and clubs in the
// chosen areas, written to the venues table. Which columns the import may change is described in
// supabase/migrations/20261109000100_foursquare_venues.sql.
//
//   npm run import:venues -- --areas soho,mayfair     (default: the 5 launch areas; "all" for all 30)
//   options: --types bar,club  --max-calls 200  --radius 700
//            --save file.json  (keep what Foursquare returned)  --from file.json  (reuse it, no API calls)
//            --dry-run         (don't write to the database)
//
// Each area is one box around its centre, searched best-rated first, so a few
// calls get the places worth recommending and skip the long tail of stale and
// unrated listings. Every call asks for opening hours, which makes it a Premium
// call (about 1.9 cents): 5 calls an area, about $2.80 for all 30.

import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { areas, launchAreaSlugs } from "../src/lib/data/areas.ts";

type VenueType = "restaurant" | "bar" | "club";

type Place = {
  fsq_place_id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  categories?: { name: string }[];
  location?: { address?: string; postcode?: string };
  hours?: { regular?: { day: number; open: string; close: string }[] };
  price?: number;
  rating?: number;
  tastes?: string[];
  website?: string;
  date_closed?: string;
};

type Found = { place: Place; types: VenueType[] };

const FSQ_SEARCH = "https://places-api.foursquare.com/places/search";
const FSQ_VERSION = "2025-06-17";
const USD_PER_CALL = 18.75 / 1000; // Premium tier, first 100,000 calls a month
const FIELDS = "fsq_place_id,name,categories,location,latitude,longitude,hours,price,rating,tastes,website,date_closed";
const CATEGORY: Record<VenueType, string> = {
  restaurant: "4d4b7105d754a06374d81259",
  bar: "4bf58dd8d48988d116941735",
  club: "4bf58dd8d48988d11f941735",
};
// Pages of 50 per area. Clubs are rare enough that one page holds them all.
const PAGES: Record<VenueType, number> = { restaurant: 2, bar: 2, club: 1 };
// Not seen for this long (three monthly runs) means closed or no longer near the top.
const STALE_AFTER_DAYS = 90;
const MAX_TUBE_KM = 1.5;

const { values: args } = parseArgs({
  options: {
    areas: { type: "string", default: launchAreaSlugs.join(",") },
    types: { type: "string", default: "restaurant,bar,club" },
    "max-calls": { type: "string", default: "200" },
    radius: { type: "string", default: "700" },
    save: { type: "string" },
    from: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

const runAreas = args.areas === "all" ? areas : areas.filter((a) => args.areas!.split(",").includes(a.slug));
const runTypes = args.types!.split(",") as VenueType[];
const maxCalls = Number(args["max-calls"]);
const radiusM = Number(args.radius);
if (runAreas.length === 0) throw new Error(`No known areas in --areas ${args.areas}`);
if (!runTypes.every((t) => t in CATEGORY)) throw new Error(`--types must be from: ${Object.keys(CATEGORY).join(", ")}`);

// ---------- Foursquare ----------

class BudgetSpent extends Error {}
let calls = 0;

async function fsqFetch(url: string): Promise<Response> {
  const key = process.env.FOURSQUARE_API_KEY;
  if (!key) throw new Error("FOURSQUARE_API_KEY isn't set.");
  if (calls >= maxCalls) throw new BudgetSpent();
  calls++;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, "X-Places-Api-Version": FSQ_VERSION, Accept: "application/json" },
    });
    if (res.ok) return res;
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    throw new Error(`Foursquare ${res.status}: ${await res.text()}`);
  }
}

type Box = { s: number; w: number; n: number; e: number };

function boxAround(area: { lat: number; lng: number }, radiusM: number): Box {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((area.lat * Math.PI) / 180));
  return { s: area.lat - dLat, w: area.lng - dLng, n: area.lat + dLat, e: area.lng + dLng };
}

async function searchArea(box: Box, type: VenueType, found: Map<string, Found>) {
  const params = new URLSearchParams({
    sw: `${box.s.toFixed(6)},${box.w.toFixed(6)}`,
    ne: `${box.n.toFixed(6)},${box.e.toFixed(6)}`,
    fsq_category_ids: CATEGORY[type],
    sort: "RATING",
    limit: "50",
    fields: FIELDS,
  });
  let url: string | null = `${FSQ_SEARCH}?${params}`;
  for (let page = 0; url && page < PAGES[type]; page++) {
    const res = await fsqFetch(url);
    for (const p of ((await res.json()) as { results: Place[] }).results) {
      const f = found.get(p.fsq_place_id) ?? { place: p, types: [] };
      if (!f.types.includes(type)) f.types.push(type);
      found.set(p.fsq_place_id, f);
    }
    url = /<([^>]+)>;\s*rel="next"/.exec(res.headers.get("link") ?? "")?.[1] ?? null;
  }
}

function inBox(b: Box, lat: number, lng: number): boolean {
  return lat >= b.s && lat <= b.n && lng >= b.w && lng <= b.e;
}

// ---------- Mapping a place to a venue row ----------

const stations = JSON.parse(readFileSync(new URL("./data/stations.json", import.meta.url), "utf8")) as [string, number, number][];

function km(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((bLat - aLat) * rad) / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(((bLng - aLng) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function nearest<T>(items: T[], at: (t: T) => [number, number], lat: number, lng: number): [T, number] {
  let best = items[0];
  let bestKm = Infinity;
  for (const t of items) {
    const [tLat, tLng] = at(t);
    const d = km(lat, lng, tLat, tLng);
    if (d < bestKm) [best, bestKm] = [t, d];
  }
  return [best, bestKm];
}

const restaurantish = /restaurant|joint|steakhouse|pizzeria|bistro|brasserie|diner|grill|trattoria|gastropub|noodle|ramen|sushi|tapas/i;
// Listed under a nightlife category but not somewhere to go out.
const notAVenue = /business|professional|services|office|store|shop|retail|school|college|university|government|medical|real estate/i;
// Private members' clubs a visitor can't get into. Foursquare doesn't flag them;
// add names here as they turn up in plans.
const membersOnly =
  /^(annabel'?s|tramp|the arts club|the groucho club|5 hertford street|loulou'?s|mark'?s club|george club|home house|ned'?s club|mortons|the conduit|maison estelle|oswald'?s|blacks club|the union club|the twenty two club|the hospital club)\b|soho house|shoreditch house|electric house|180 house|white city house|little house mayfair|members'? club|private members/i;
// Not somewhere for dinner on a night out.
const notDinner =
  /fast food|sandwich|food court|food truck|food stand|bakery|caf[eé]|coffee|tea room|juice|bubble tea|dessert|ice cream|donut|bagel|deli|snack|fried chicken|cafeteria|breakfast/i;

// The search that found a place says it has that category somewhere; its first
// category says what it mainly is. A late opener from the club search is a club
// whatever its first category (The Box Soho is a "Speakeasy" open 11pm to 5am).
function venueType(primary: string, types: VenueType[], hours: ReturnType<typeof periods>): VenueType {
  const opensLate = hours.length > 0 && hours.filter((h) => h.opens >= "21:00").length * 2 > hours.length;
  if (types.includes("club") && (/night ?club/i.test(primary) || opensLate)) return "club";
  if (types.includes("restaurant") && restaurantish.test(primary)) return "restaurant";
  if (types.includes("bar")) return "bar";
  return types.includes("restaurant") ? "restaurant" : "club";
}

// Tags inferred from Foursquare's categories and "tastes". Hand-set tags live in
// vibe_tags / music_tags and are never touched by the import.
const vibeRules: [string, RegExp][] = [
  ["hidden", /speakeasy|hidden|secret|basement|underground/i],
  ["views", /rooftop|roof terrace|\bviews?\b|skyline/i],
  ["classic", /^pub$|irish pub|historic|traditional|old.school|classic|sunday roast|\bpies\b|real ale/i],
  ["glamorous", /hotel bar|lounge|champagne|upscale|fancy|glamorous|luxur|elegant|chic|special occasions/i],
  ["buzzy", /crowded|lively|busy|buzz|trendy|party|good for groups|dancing/i],
  ["rowdy", /dive bar|sports bar|karaoke|beer hall|rowdy|\bloud\b|cheap drinks|happy hour/i],
  ["romantic", /wine bar|romantic|good for dates|date night|intimate|candle|\bcute\b/i],
  ["relaxed", /relaxed|chill|quiet|laid.back|calm|beer garden|\bgardens?\b|cosy|cozy|\bcasual\b/i],
];
const musicRules: [string, RegExp][] = [
  ["live-jazz", /jazz|blues|live music|music venue|piano bar/i],
  ["house-techno", /techno|house music|electronic|\bedm\b/i],
  ["hiphop-rnb", /hip.?hop|r&b|\brnb\b|\brap\b|afrobeat|reggaeton|dancehall/i],
  ["pop-throwbacks", /karaoke|\bpop\b|\b[89]0s\b|disco|cheesy|throwback|retro/i],
];

function tagsFrom(rules: [string, RegExp][], texts: string[]): string[] {
  return rules.filter(([, re]) => texts.some((t) => re.test(t))).map(([tag]) => tag);
}

function hhmm(s: string | undefined): string | null {
  const m = /^\+?(\d{2})(\d{2})$/.exec(s ?? "");
  return m ? `${String(Number(m[1]) % 24).padStart(2, "0")}:${m[2]}` : null;
}

// Foursquare days run 1 = Monday to 7 = Sunday; ours run 0 = Monday. A close of
// "+0200" means 2am the next morning, which our closes < opens convention covers.
function periods(p: Place): { weekday: number; opens: string; closes: string }[] {
  const seen = new Set<string>();
  return (p.hours?.regular ?? []).flatMap((h) => {
    const weekday = h.day - 1;
    const opens = hhmm(h.open);
    const closes = hhmm(h.close);
    if (weekday < 0 || weekday > 6 || !opens || !closes || seen.has(`${weekday} ${opens}`)) return [];
    seen.add(`${weekday} ${opens}`);
    return [{ weekday, opens, closes }];
  });
}

type Row = {
  fsq_id: string;
  name: string;
  type: VenueType;
  area_slug: string;
  address: string | null;
  lat: number;
  lng: number;
  nearest_tube: string | null;
  price_band: number | null;
  rating: number | null;
  fsq_categories: string[];
  fsq_tastes: string[];
  auto_vibe_tags: string[];
  auto_music_tags: string[];
  website_url: string | null;
  last_seen_at: string;
};

const runStart = new Date();
const skipped: Record<string, number> = {};

function toRow({ place: p, types }: Found): { row: Row; hours: ReturnType<typeof periods>; closed: boolean } | null {
  if (p.latitude === undefined || p.longitude === undefined) return null;
  const categories = (p.categories ?? []).map((c) => c.name);
  const primary = categories[0] ?? "";
  const hours = periods(p);
  const type = venueType(primary, types, hours);
  // No hours and no rating is usually a stale or private listing. Rated venues
  // without hours are kept so hours can be added by hand.
  const reason = notAVenue.test(primary)
    ? "not a venue"
    : membersOnly.test(p.name)
      ? "members only"
    : type === "restaurant" && notDinner.test(primary)
      ? "not for dinner"
      : !p.hours?.regular?.length && p.rating === undefined
        ? "no hours or rating"
        : null;
  if (reason) {
    skipped[reason] = (skipped[reason] ?? 0) + 1;
    return null;
  }
  const [area] = nearest(areas, (a) => [a.lat, a.lng], p.latitude, p.longitude);
  const [tube, tubeKm] = nearest(stations, (s) => [s[1], s[2]], p.latitude, p.longitude);
  const texts = [...categories, ...(p.tastes ?? [])];
  return {
    row: {
      fsq_id: p.fsq_place_id,
      name: p.name.trim(),
      type,
      area_slug: area.slug,
      address: [p.location?.address, p.location?.postcode].filter(Boolean).join(", ") || null,
      lat: p.latitude,
      lng: p.longitude,
      nearest_tube: tubeKm <= MAX_TUBE_KM ? tube[0] : null,
      price_band: p.price && p.price >= 1 && p.price <= 4 ? p.price : null,
      rating: p.rating ?? null,
      fsq_categories: categories,
      fsq_tastes: p.tastes ?? [],
      auto_vibe_tags: tagsFrom(vibeRules, texts),
      auto_music_tags: type === "restaurant" ? [] : tagsFrom(musicRules, texts),
      website_url: p.website ?? null,
      last_seen_at: runStart.toISOString(),
    },
    hours,
    closed: Boolean(p.date_closed),
  };
}

function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------- Run ----------

const found = new Map<string, Found>();
const boxes = runAreas.map((a) => boxAround(a, radiusM));
let complete = true;

if (args.from) {
  for (const f of JSON.parse(readFileSync(args.from, "utf8")) as Found[]) found.set(f.place.fsq_place_id, f);
  console.log(`Loaded ${found.size} places from ${args.from}; no Foursquare calls made.`);
} else {
  try {
    for (const [i, area] of runAreas.entries()) {
      const before = calls;
      for (const type of runTypes) await searchArea(boxes[i], type, found);
      console.log(`${area.name}: ${calls - before} calls, ${found.size} places found so far`);
    }
  } catch (e) {
    if (!(e instanceof BudgetSpent)) throw e;
    complete = false;
    console.warn(`\nStopped at the --max-calls limit (${maxCalls}). Coverage is incomplete; stale venues won't be unpublished.`);
  }
  console.log(`\nFoursquare: ${calls} calls, about $${(calls * USD_PER_CALL).toFixed(2)}.`);
  if (args.save) {
    writeFileSync(args.save, JSON.stringify([...found.values()]));
    console.log(`Saved ${found.size} places to ${args.save}`);
  }
}

const mapped = [...found.values()].map(toRow).filter((m) => m !== null);
const byAreaType = new Map<string, number>();
for (const { row } of mapped) byAreaType.set(`${row.area_slug} ${row.type}`, (byAreaType.get(`${row.area_slug} ${row.type}`) ?? 0) + 1);
console.log(`\n${mapped.length} venues after filtering:`);
for (const [k, n] of [...byAreaType].sort()) console.log(`  ${k}: ${n}`);
console.log(`Skipped: ${Object.entries(skipped).map(([c, n]) => `${c} ${n}`).join(", ") || "none"}`);
console.log(
  `With hours: ${mapped.filter((m) => m.hours.length).length}, with a price: ${mapped.filter((m) => m.row.price_band).length}, ` +
    `with inferred vibes: ${mapped.filter((m) => m.row.auto_vibe_tags.length).length}, marked closed: ${mapped.filter((m) => m.closed).length}`,
);

if (args["dry-run"]) {
  console.log("\nDry run: nothing written to the database.");
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

async function selectAll<T>(table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`Reading ${table}: ${error.message}`);
    rows.push(...(data as T[]));
    if (data.length < 1000) return rows;
  }
}

function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
}

type Existing = { id: string; slug: string; fsq_id: string | null; verified: boolean };
const existing = await selectAll<Existing>("venues", "id, slug, fsq_id, verified");
const byFsq = new Map(existing.filter((e) => e.fsq_id).map((e) => [e.fsq_id!, e]));
const usedSlugs = new Set(existing.map((e) => e.slug));

function uniqueSlug(row: Row): string {
  const base = slugify(row.name) || "venue";
  for (const candidate of [base, `${base}-${row.area_slug}`]) {
    if (!usedSlugs.has(candidate)) return (usedSlugs.add(candidate), candidate);
  }
  for (let n = 2; ; n++) {
    const candidate = `${base}-${row.area_slug}-${n}`;
    if (!usedSlugs.has(candidate)) return (usedSlugs.add(candidate), candidate);
  }
}

const hoursFor = new Map(mapped.map((m) => [m.row.fsq_id, m.hours]));
const refreshHours: { id: string; fsq_id: string }[] = [];
let inserted = 0, updated = 0, verifiedTouched = 0, unpublished = 0;

const fresh = mapped.filter((m) => !byFsq.has(m.row.fsq_id) && !m.closed);
for (const batch of chunks(fresh, 500)) {
  const rows = batch.map((m) => ({ ...m.row, slug: uniqueSlug(m.row), source: "foursquare", published: true }));
  const { data, error } = await db.from("venues").insert(rows).select("id, fsq_id");
  if (error) throw new Error(`Inserting venues: ${error.message}`);
  refreshHours.push(...data);
  inserted += data.length;
}

const known = mapped.filter((m) => byFsq.has(m.row.fsq_id) && !byFsq.get(m.row.fsq_id)!.verified);
for (const batch of chunks(known, 500)) {
  // slug is included only because upsert needs every not-null column; it's unchanged.
  const rows = batch.map((m) => ({ ...m.row, slug: byFsq.get(m.row.fsq_id)!.slug }));
  const { data, error } = await db.from("venues").upsert(rows, { onConflict: "fsq_id" }).select("id, fsq_id");
  if (error) throw new Error(`Updating venues: ${error.message}`);
  refreshHours.push(...data);
  updated += data.length;
}

const closedIds = known.filter((m) => m.closed).map((m) => byFsq.get(m.row.fsq_id)!.id);
for (const batch of chunks(closedIds, 200)) {
  const { error } = await db.from("venues").update({ published: false }).in("id", batch);
  if (error) throw new Error(`Unpublishing closed venues: ${error.message}`);
  unpublished += batch.length;
}

// Checked venues keep everything set by hand; only Foursquare's own signals refresh.
for (const m of mapped.filter((m) => byFsq.get(m.row.fsq_id)?.verified)) {
  const { error } = await db
    .from("venues")
    .update({ rating: m.row.rating, fsq_tastes: m.row.fsq_tastes, last_seen_at: m.row.last_seen_at })
    .eq("id", byFsq.get(m.row.fsq_id)!.id);
  if (error) throw new Error(`Updating ${m.row.name}: ${error.message}`);
  if (m.closed) console.warn(`Checked venue ${m.row.name} is marked closed on Foursquare. Review it by hand.`);
  verifiedTouched++;
}

for (const batch of chunks(refreshHours, 200)) {
  const ids = batch.map((b) => b.id);
  const { error: delError } = await db.from("venue_hours").delete().in("venue_id", ids);
  if (delError) throw new Error(`Clearing hours: ${delError.message}`);
  const rows = batch.flatMap((b) => (hoursFor.get(b.fsq_id) ?? []).map((h) => ({ venue_id: b.id, ...h })));
  if (rows.length === 0) continue;
  const { error } = await db.from("venue_hours").insert(rows);
  if (error) throw new Error(`Saving hours: ${error.message}`);
}

// Venues missing from three runs in a row have closed or dropped well down the
// ratings. Only venues inside the boxes searched this run are judged, and only after a full run.
let stale = 0;
if (complete && !args.from) {
  const cutoff = new Date(runStart.getTime() - STALE_AFTER_DAYS * 86_400_000).toISOString();
  const { data, error } = await db
    .from("venues")
    .select("id, lat, lng, type")
    .eq("source", "foursquare")
    .eq("verified", false)
    .eq("published", true)
    .lt("last_seen_at", cutoff)
    .in("type", runTypes);
  if (error) throw new Error(`Finding stale venues: ${error.message}`);
  const ids = data.filter((v) => boxes.some((b) => inBox(b, v.lat, v.lng))).map((v) => v.id);
  for (const batch of chunks(ids, 200)) {
    const { error: e } = await db.from("venues").update({ published: false }).in("id", batch);
    if (e) throw new Error(`Unpublishing stale venues: ${e.message}`);
  }
  stale = ids.length;
}

console.log(
  `\nDatabase: ${inserted} added, ${updated} refreshed, ${verifiedTouched} checked venues refreshed, ` +
    `${unpublished} closed and ${stale} stale venues unpublished.`,
);
