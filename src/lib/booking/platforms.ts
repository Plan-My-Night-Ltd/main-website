// Booking platforms London venues use, and how to recognise one from a URL or a
// page's HTML. Shared by the app and scripts/enrich-booking.mts, so no "@/" imports.

export type BookingPlatform = "opentable" | "sevenrooms" | "resy" | "resdiary" | "designmynight" | "thefork" | "tock" | "other";

export const platformLabel: Record<BookingPlatform, string> = {
  opentable: "OpenTable",
  sevenrooms: "SevenRooms",
  resy: "Resy",
  resdiary: "ResDiary",
  designmynight: "DesignMyNight",
  thefork: "TheFork",
  tock: "Tock",
  other: "their booking page",
};

export type DetectedBooking = { platform: BookingPlatform; id: string | null; url: string };

// Path segments that look like venue slugs but are the platforms' own pages.
const notASlug = /^(widget|widgets|api|static|assets|embed|explore|reservations|search|join|about|help|login|signup|cities|london|restaurants?|en|en-gb)$/i;
const urlChars = "[^\\s\"'<>()\\\\]";

type Pattern = {
  platform: BookingPlatform;
  re: RegExp;
  id: (m: RegExpExecArray) => string | null;
  url?: (m: RegExpExecArray) => string; // when the match itself isn't a page to send people to
};

// Most specific first: a page can mention several platforms (a widget plus a
// "find us on TheFork" badge), and the first match in this order wins.
const patterns: Pattern[] = [
  { platform: "opentable", re: new RegExp(`(?:https?:)?//(?:www\\.)?opentable\\.(?:co\\.uk|com|ie)/r/([a-z0-9-]+)${urlChars}*`, "i"), id: (m) => m[1].toLowerCase() },
  { platform: "opentable", re: new RegExp(`(?:https?:)?//(?:www\\.|widget\\.)?opentable\\.(?:co\\.uk|com|ie)/${urlChars}*?[?&;](?:rid|restref)=(\\d+)${urlChars}*`, "i"), id: (m) => m[1], url: (m) => `https://www.opentable.co.uk/restaurant/profile/${m[1]}` },
  { platform: "opentable", re: new RegExp(`(?:https?:)?//(?:www\\.)?opentable\\.(?:co\\.uk|com|ie)/restaurant/profile/(\\d+)${urlChars}*`, "i"), id: (m) => m[1] },
  { platform: "sevenrooms", re: new RegExp(`(?:https?:)?//(?:www\\.)?sevenrooms\\.com/(?:reservations|explore)/([a-z0-9_-]+)${urlChars}*`, "i"), id: (m) => m[1].toLowerCase() },
  { platform: "resy", re: new RegExp(`(?:https?:)?//(?:www\\.)?resy\\.com/cities/([a-z-]+)/(?:venues/)?([a-z0-9-]+)${urlChars}*`, "i"), id: (m) => `${m[1]}/${m[2]}`.toLowerCase() },
  { platform: "resdiary", re: new RegExp(`(?:https?:)?//(?:booking\\.|www\\.)?resdiary\\.com/(?:widget/[a-z]+/|restaurant/)([a-z0-9_-]+)(?:/(\\d+))?${urlChars}*`, "i"), id: (m) => (m[2] ? `${m[1]}/${m[2]}` : m[1]) },
  { platform: "tock", re: new RegExp(`(?:https?:)?//(?:www\\.)?exploretock\\.com/([a-z0-9-]+)${urlChars}*`, "i"), id: (m) => m[1].toLowerCase() },
  { platform: "thefork", re: new RegExp(`(?:https?:)?//(?:www\\.)?thefork\\.co\\.uk/restaurant/([a-z0-9-]+)${urlChars}*`, "i"), id: (m) => m[1].toLowerCase() },
  { platform: "designmynight", re: new RegExp(`(?:https?:)?//(?:www\\.)?designmynight\\.com/london/${urlChars}+`, "i"), id: () => null },
];

/** The first booking-platform link in a URL or a page's HTML, most specific platform first. */
export function detectBooking(text: string): DetectedBooking | null {
  const decoded = text.replace(/&amp;/g, "&");
  for (const p of patterns) {
    const m = p.re.exec(decoded);
    if (!m) continue;
    const id = p.id(m);
    if (id && notASlug.test(id.split("/").pop()!)) continue;
    const url = p.url ? p.url(m) : m[0].startsWith("//") ? `https:${m[0]}` : m[0];
    return { platform: p.platform, id, url };
  }
  return null;
}

/** Google's "Reserve a table" provider name ("OpenTable", "SevenRooms", ...) as a platform. */
export function platformFromName(name: string | null | undefined): BookingPlatform | null {
  if (!name) return null;
  const n = name.toLowerCase().replace(/[^a-z]/g, "");
  const known: [string, BookingPlatform][] = [
    ["opentable", "opentable"],
    ["sevenrooms", "sevenrooms"],
    ["resy", "resy"],
    ["resdiary", "resdiary"],
    ["designmynight", "designmynight"],
    ["collins", "designmynight"], // DesignMyNight's venue software
    ["thefork", "thefork"],
    ["tock", "tock"],
  ];
  return known.find(([k]) => n.includes(k))?.[1] ?? "other";
}

export function isBookingPlatform(s: unknown): s is BookingPlatform {
  return typeof s === "string" && s in platformLabel;
}
