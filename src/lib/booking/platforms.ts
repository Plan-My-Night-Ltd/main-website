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
  { platform: "sevenrooms", re: new RegExp(`(?:https?:)?//(?:www\\.)?sevenrooms\\.com/(?:reservations|explore)/([a-z0-9_-]+)${urlChars}*`, "i"), id: (m) => m[1].toLowerCase(), url: (m) => sevenRoomsUrl(m[1]) },
  { platform: "resy", re: new RegExp(`(?:https?:)?//(?:www\\.)?resy\\.com/cities/([a-z-]+)/(?:venues/)?([a-z0-9-]+)${urlChars}*`, "i"), id: (m) => `${m[1]}/${m[2]}`.toLowerCase() },
  { platform: "resdiary", re: new RegExp(`(?:https?:)?//(?:booking\\.|www\\.)?resdiary\\.com/(?:widget/[a-z]+/|restaurant/)([a-z0-9_-]+)(?:/(\\d+))?${urlChars}*`, "i"), id: (m) => (m[2] ? `${m[1]}/${m[2]}` : m[1]) },
  { platform: "tock", re: new RegExp(`(?:https?:)?//(?:www\\.)?exploretock\\.com/([a-z0-9-]+)${urlChars}*`, "i"), id: (m) => m[1].toLowerCase() },
  { platform: "thefork", re: new RegExp(`(?:https?:)?//(?:www\\.)?thefork\\.co\\.uk/restaurant/([a-z0-9-]+)${urlChars}*`, "i"), id: (m) => m[1].toLowerCase() },
  // A venue's own page, not its events and offers: /london/<type>/<area>/<venue>.
  { platform: "designmynight", re: /(?:https?:)?\/\/(?:www\.)?designmynight\.com\/london\/(?:restaurants|bars|pubs|clubs)\/[a-z0-9-]+\/([a-z0-9-]+)(?=[/?"'\s#]|$)(?!\/)/i, id: (m) => m[1].toLowerCase(), url: (m) => m[0].replace(/^\/\//, "https://") },
];

// SevenRooms' plain booking page for a venue: the one its own widget opens, and
// the one that reads date, party_size and start_time. Saved links often carry an
// old date or a private-dining path, so they're rebuilt from the id.
function sevenRoomsUrl(id: string): string {
  return `https://www.sevenrooms.com/explore/${id.toLowerCase()}/reservations/create/search`;
}

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

/**
 * Every booking-platform link on a page, one per platform and id. A chain's site
 * often lists all its branches; pickBranch chooses between them.
 */
export function detectAllBookings(html: string): DetectedBooking[] {
  const text = html.replace(/&amp;/g, "&").replace(/\\\//g, "/");
  const found = new Map<string, DetectedBooking>();
  for (const m of text.matchAll(/(?:https?:)?\/\/[^\s"'<>()\\]+/g)) {
    const d = detectBooking(m[0]);
    if (!d) continue;
    // A group page (".../explore/flatirongroup/...?venues=flatironsoho,flatironshoreditch")
    // lists every branch; each is a candidate in its own right.
    const branches = d.platform === "sevenrooms" ? /[?&]venues=([^&]+)/.exec(m[0])?.[1] : undefined;
    if (branches) {
      for (const id of decodeURIComponent(branches).split(",").map((b) => b.trim().toLowerCase()).filter(Boolean)) {
        if (!notASlug.test(id)) found.set(`sevenrooms:${id}`, { platform: "sevenrooms", id, url: sevenRoomsUrl(id) });
      }
    } else {
      found.set(`${d.platform}:${d.id ?? d.url}`, d);
    }
  }
  // SevenRooms widgets are often set up in script: SevenroomsWidget.init({ venueId: "..." }).
  if (/sevenrooms\.com/i.test(text)) {
    for (const m of text.matchAll(/venue_?id["']?\s*[:=]\s*["']([a-z0-9_-]{3,})["']/gi)) {
      const id = m[1].toLowerCase();
      if (!notASlug.test(id)) found.set(`sevenrooms:${id}`, { platform: "sevenrooms", id, url: sevenRoomsUrl(id) });
    }
  }
  return [...found.values()];
}

// Words that say nothing about which branch a link is for.
const genericWord = /^(the|and|london|street|road|lane|place|square|restaurant|restaurants|bar|kitchen|reservations?|booking|book|table|www|com|http|https)$/;

function branchWords(text: string): string[] {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !genericWord.test(w));
}

// Places a branch id can be named after. A link naming one of these that isn't
// where the venue is belongs to another branch ("homeslicecity" for Covent Garden).
const placeNames = [
  "soho", "mayfair", "coventgarden", "fitzrovia", "marylebone", "victoria", "carnaby", "shoreditch", "clerkenwell",
  "hackney", "dalston", "bethnalgreen", "wapping", "kensington", "nottinghill", "chelsea", "fulham", "hammersmith",
  "brixton", "borough", "bankside", "bermondsey", "peckham", "clapham", "southbank", "camden", "islington",
  "kingscross", "hampstead", "stokenewington", "city", "westend", "waterloo", "battersea", "canarywharf",
  "spitalfields", "londonbridge", "piccadilly", "westfield", "richmond", "wimbledon", "stratford", "greenwich",
  "paddington", "euston", "holborn", "bloomsbury", "exmouthmarket", "seven dials", "sevendials", "tottenhamctrd",
  "manchester", "birmingham", "edinburgh", "glasgow", "bristol", "leeds", "liverpool", "brighton", "cambridge",
  "oxford", "newcastle", "dubai", "newyork", "nyc", "paris", "geneva", "miami", "doha", "riyadh", "bicester",
].map((p) => p.replace(/\s/g, ""));

function contradicts(key: string, venueText: string): boolean {
  return placeNames.some((p) => key.includes(p) && !venueText.includes(p));
}

/**
 * The link for this branch out of everything found on a site: the one whose id
 * shares the most words with the venue's name, area and address
 * ("santamariafulham" for Santa Maria in Fulham). Null when it's a tie, so a
 * chain's other branch is never booked by mistake.
 */
export function pickBranch(found: DetectedBooking[], venue: { name: string; area?: string; address?: string | null }): DetectedBooking | null {
  const venueText = [venue.name, venue.area, venue.address].join(" ").toLowerCase().replace(/[^a-z]/g, "");
  found = found.filter((d) => !contradicts((d.id ?? d.url).toLowerCase().replace(/[^a-z]/g, ""), venueText));
  if (found.length <= 1) return found[0] ?? null;
  const want = [...new Set([...branchWords(venue.name), ...branchWords(venue.area ?? ""), ...branchWords(venue.address ?? "")])];
  const compactArea = (venue.area ?? "").toLowerCase().replace(/[^a-z]/g, "");
  const scored = found
    .map((d) => {
      const key = (d.id ?? d.url).toLowerCase().replace(/[^a-z0-9]/g, "");
      let score = want.filter((w) => key.includes(w)).length;
      if (compactArea.length >= 4 && key.includes(compactArea)) score += 2;
      return { d, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0].score > 0 && scored[0].score > scored[1].score ? scored[0].d : null;
}

// Tracking and session parameters Google and the platforms add to links. They can
// expire or credit someone else's referral, so they're dropped before saving.
const trackingParam = /^(utm_.*|ref|tracking|rwg_token|y_source|gei|opi|source|sourceurl|oiwv|allowguest|hl|cc|corrid|originid|gclid|fbclid)$/i;

/** A booking link without tracking: Google's own reserve links lose their whole query. */
export function cleanBookingUrl(raw: string): string {
  try {
    const url = new URL(raw);
    if (/(^|\.)google\.[a-z.]+$/.test(url.hostname)) url.search = "";
    for (const key of [...url.searchParams.keys()]) if (trackingParam.test(key)) url.searchParams.delete(key);
    return url.toString();
  } catch {
    return raw;
  }
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
