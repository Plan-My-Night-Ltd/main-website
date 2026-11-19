import { platformLabel, type BookingPlatform } from "@/lib/booking/platforms";
import { friendlyTime } from "@/lib/format";
import type { Venue } from "@/lib/types";

// Where "Book" goes, with the night's date, time and party size filled in when
// the platform's booking page reads them from the URL. Each platform ignores
// query parameters it doesn't know, so a wrong guess still lands on the right page.

export type BookingRequest = { date: string; time: string; partySize: number }; // YYYY-MM-DD, HH:MM

export type BookingTarget = {
  href: string;
  label: string;
  kind: "book" | "website" | "maps";
  platform?: BookingPlatform;
};

// Query parameters each platform's own booking page reads. These come from links
// seen in the wild, not official docs: check each on a real London venue before
// relying on it. DesignMyNight, ResDiary and TheFork links are used as they are.
const prefill: Partial<Record<BookingPlatform, { host: RegExp; params: (r: BookingRequest, url: URL) => Record<string, string> }>> = {
  opentable: {
    host: /(^|\.)opentable\.(co\.uk|com|ie)$/,
    // Restaurant pages read p and sd; the booking flow and widget read covers and dateTime.
    params: (r, url): Record<string, string> =>
      /^\/(r|restaurant\/profile)\//.test(url.pathname)
        ? { p: String(r.partySize), sd: `${r.date}T${r.time}:00` }
        : { covers: String(r.partySize), dateTime: `${r.date}T${r.time}` },
  },
  resy: { host: /(^|\.)resy\.com$/, params: (r) => ({ date: r.date, seats: String(r.partySize) }) },
  sevenrooms: { host: /(^|\.)sevenrooms\.com$/, params: (r) => ({ date: r.date, party_size: String(r.partySize), start_time: r.time }) },
  tock: { host: /(^|\.)exploretock\.com$/, params: (r) => ({ date: r.date, size: String(r.partySize), time: r.time }) },
};

function withPrefill(bookingUrl: string, platform: BookingPlatform | undefined, request: BookingRequest | undefined): string | null {
  const rule = platform && prefill[platform];
  if (!rule || !request) return null;
  try {
    const url = new URL(bookingUrl);
    if (!rule.host.test(url.hostname)) return null; // e.g. Google's own "Reserve a table" link
    for (const [k, v] of Object.entries(rule.params(request, url))) url.searchParams.set(k, v);
    return url.toString();
  } catch {
    return null;
  }
}

/** Booking page if known, else the venue's website, else Google Maps. */
export function bookingTarget(venue: Venue, request?: BookingRequest): BookingTarget {
  const tickets = venue.type === "club";
  const platform = venue.bookingPlatform;
  const via = platform && platform !== "other" ? ` · ${platformLabel[platform]}` : "";

  if (venue.bookingUrl) {
    const prefilled = withPrefill(venue.bookingUrl, platform, request);
    if (prefilled && request) {
      return { href: prefilled, label: `Book for ${request.partySize} at ${friendlyTime(request.time)}${via}`, kind: "book", platform };
    }
    return { href: venue.bookingUrl, label: `${tickets ? "Get tickets" : "Book a table"}${via}`, kind: "book", platform };
  }
  if (venue.websiteUrl) {
    const label = tickets ? "Tickets on their website" : venue.acceptsReservations === false ? "Visit their website" : "Book on their website";
    return { href: venue.websiteUrl, label, kind: "website" };
  }
  return {
    href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.name}, ${venue.address || "London"}`)}`,
    label: "Find on Google Maps",
    kind: "maps",
  };
}

/** "Book ahead", "Walk-ins only", or nothing when we don't know. */
export function bookingFact(venue: Venue): string | undefined {
  if (venue.type === "club") return venue.bookingUrl ? "Book ahead" : venue.verified ? "Walk-ins only" : undefined;
  if (venue.acceptsReservations === false) return "Walk-ins only";
  if (venue.bookingUrl || venue.acceptsReservations) {
    return venue.bookingPlatform && venue.bookingPlatform !== "other"
      ? `Book ahead on ${platformLabel[venue.bookingPlatform]}`
      : "Book ahead";
  }
  return venue.verified ? "Walk-ins only" : undefined;
}

/** Google's usual busyness (0 to 100) at a time on the night, or undefined if Google has none. */
export function usualBusyness(venue: Venue, weekday: number, minutes: number): number | undefined {
  const day = (weekday + Math.floor(minutes / 1440)) % 7; // after midnight counts as the next day
  const hour = Math.floor((minutes % 1440) / 60);
  const value = venue.popularTimes?.[day]?.[hour];
  return typeof value === "number" ? value : undefined;
}
