import { unstable_cache } from "next/cache";
import { londonToday, toMinutes } from "@/lib/format";
import type { Venue } from "@/lib/types";

// Live table availability for OpenTable venues, through Apify's "OpenTable
// Availability Checker" (clearpath/opentable-availability-api). One check is one
// venue, date and party size, about $0.003. A plan checks at most a few venues
// per stop in a single run, and the same check is reused for 15 minutes.

const ACTOR = "clearpath~opentable-availability-api";
const MAX_VENUES_PER_RUN = 10; // the actor's limit
const MAX_USD_PER_RUN = 0.05; // stops a run before it spends more than this
const TIMEOUT_MS = 25_000;
const CACHE_SECONDS = 15 * 60;
const BOOKING_WINDOW_DAYS = 60;

export type TableStatus = "available" | "sold_out" | "not_yet_bookable";
export type Availability = { status: TableStatus; times: string[] }; // "HH:MM", that evening

/** Venues we can check: OpenTable venues whose booking link is an OpenTable page. */
export function checkable(venue: Venue): boolean {
  return venue.bookingPlatform === "opentable" && openTablePage(venue.bookingUrl) !== null;
}

function openTablePage(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!/(^|\.)opentable\.(co\.uk|com|ie)$/.test(u.hostname)) return null;
    return `${u.origin}${u.pathname}`;
  } catch {
    return null;
  }
}

type Row = { url?: string; inputUrl?: string; startUrl?: string; status?: string; slots?: { time?: string; startTime?: string }[] };

// Keyed on the exact list of pages, date and party size, so the same plan opened
// again (or shared) within 15 minutes costs nothing.
const runCheck = unstable_cache(
  async (pages: string[], date: string, partySize: number): Promise<Record<string, Availability>> => {
    const token = process.env.APIFY_TOKEN;
    if (!token) return {};
    const res = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?maxTotalChargeUsd=${MAX_USD_PER_RUN}&timeout=${TIMEOUT_MS / 1000}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ startUrls: pages.map((url) => ({ url })), date, partySize }),
        signal: AbortSignal.timeout(TIMEOUT_MS + 5_000),
        cache: "no-store",
      },
    );
    if (!res.ok) throw new Error(`OpenTable availability check failed: ${res.status} ${await res.text()}`);
    const rows = (await res.json()) as Row[];
    const out: Record<string, Availability> = {};
    rows.forEach((row, i) => {
      if (row.status !== "available" && row.status !== "sold_out" && row.status !== "not_yet_bookable") return;
      // Rows come back in input order; match on URL when the actor echoes one.
      const echoed = openTablePage(row.url ?? row.inputUrl ?? row.startUrl);
      const page = echoed && pages.includes(echoed) ? echoed : pages[i];
      if (!page) return;
      const times = (row.slots ?? [])
        .map((s) => (s.time ?? s.startTime ?? "").slice(11, 16) || (s.time ?? s.startTime ?? ""))
        .filter((t) => /^\d{2}:\d{2}$/.test(t));
      out[page] = { status: row.status, times: [...new Set(times)].sort() };
    });
    return out;
  },
  ["opentable-availability"],
  { revalidate: CACHE_SECONDS },
);

/**
 * Availability for each checkable venue (by slug) on the night. Venues that
 * couldn't be checked are missing, and so is everything when the check fails:
 * availability only adds to a plan, it never holds one up.
 */
export async function checkAvailability(venues: Venue[], date: string, partySize: number): Promise<Map<string, Availability>> {
  const result = new Map<string, Availability>();
  const today = londonToday();
  const daysAhead = (Date.parse(date) - Date.parse(today)) / 86_400_000;
  if (!process.env.APIFY_TOKEN || daysAhead < 0 || daysAhead > BOOKING_WINDOW_DAYS) return result;

  const pageOf = new Map<string, string>();
  for (const v of venues) {
    const page = checkable(v) ? openTablePage(v.bookingUrl) : null;
    if (page) pageOf.set(v.slug, page);
  }
  const pages = [...new Set(pageOf.values())].sort().slice(0, MAX_VENUES_PER_RUN);
  if (pages.length === 0) return result;

  try {
    const byPage = await runCheck(pages, date, partySize);
    for (const [slug, page] of pageOf) if (byPage[page]) result.set(slug, byPage[page]);
  } catch (e) {
    console.error(e);
  }
  return result;
}

/** Bookable times within `windowMinutes` of arrival, closest first. */
export function timesNear(a: Availability, arrive: number, windowMinutes = 45): string[] {
  const target = arrive % 1440;
  return a.times
    .filter((t) => Math.abs(toMinutes(t) - target) <= windowMinutes)
    .sort((x, y) => Math.abs(toMinutes(x) - target) - Math.abs(toMinutes(y) - target) || x.localeCompare(y));
}
