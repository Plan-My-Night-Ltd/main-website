// What the questionnaire collects, and how it travels in the shareable URL.
// Until plans are stored in Supabase, /plan/[id] carries the answers in the id.

export type Stop = "dinner" | "drinks" | "club";
export type Group = "date" | "friends" | "celebration" | "solo";
export type Music = "house-techno" | "hiphop-rnb" | "live-jazz" | "pop-throwbacks" | "any";

export type Answers = {
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  stops: Stop[];
  group: Group;
  partySize: number;
  area: string; // area slug, "region:<region>", or "anywhere"
  budget: 1 | 2 | 3 | 4;
  vibes: string[];
  music: Music;
  swaps?: Partial<Record<Stop, string>>; // stop -> venue slug the guest picked instead
};

export const stopOrder: Stop[] = ["dinner", "drinks", "club"];

export const stopLabel: Record<Stop, string> = {
  dinner: "Dinner",
  drinks: "Drinks",
  club: "Dancing",
};

export const groupOptions: { value: Group; label: string; hint: string; tags: string[] }[] = [
  { value: "date", label: "A date", hint: "Somewhere you can talk", tags: ["romantic", "hidden"] },
  { value: "friends", label: "Friends", hint: "Loud, easy, good value", tags: ["buzzy", "rowdy"] },
  { value: "celebration", label: "A celebration", hint: "Birthdays, hen and stag dos, big news", tags: ["glamorous", "buzzy"] },
  { value: "solo", label: "Just me", hint: "Bar seats and good company", tags: ["relaxed", "classic"] },
];

export const vibeOptions: { value: string; label: string }[] = [
  { value: "buzzy", label: "Buzzy" },
  { value: "romantic", label: "Romantic" },
  { value: "glamorous", label: "Glamorous" },
  { value: "hidden", label: "Hidden away" },
  { value: "relaxed", label: "Laid-back" },
  { value: "rowdy", label: "Rowdy" },
  { value: "classic", label: "Old London" },
  { value: "views", label: "Views" },
];

export const musicOptions: { value: Music; label: string }[] = [
  { value: "house-techno", label: "House and techno" },
  { value: "hiphop-rnb", label: "Hip-hop and R&B" },
  { value: "live-jazz", label: "Live music and jazz" },
  { value: "pop-throwbacks", label: "Pop and throwbacks" },
  { value: "any", label: "Not fussed" },
];

export const budgetOptions: { value: Answers["budget"]; label: string; hint: string }[] = [
  { value: 1, label: "£", hint: "Under £40 a head" },
  { value: 2, label: "££", hint: "£40 to £80" },
  { value: 3, label: "£££", hint: "£80 to £150" },
  { value: 4, label: "££££", hint: "£150 and up" },
];

export const nightShapes: { stops: Stop[]; label: string; hint: string }[] = [
  { stops: ["dinner", "drinks", "club"], label: "The full night", hint: "Dinner, drinks, then dancing" },
  { stops: ["dinner", "drinks"], label: "Dinner and drinks", hint: "Home before the clubs fill up" },
  { stops: ["drinks", "club"], label: "Drinks and dancing", hint: "Eat beforehand, or don't" },
  { stops: ["dinner"], label: "Just dinner", hint: "One great table" },
];

function toBase64Url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return atob(padded);
}

// Answers only contain ASCII (slugs, dates, tags), so plain btoa is safe.
export function encodeAnswers(a: Answers): string {
  return toBase64Url(JSON.stringify(a));
}

export function decodeAnswers(id: string): Answers | null {
  try {
    const a = JSON.parse(fromBase64Url(id)) as Answers;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date) || !/^\d{2}:\d{2}$/.test(a.start)) return null;
    if (!Array.isArray(a.stops) || a.stops.length === 0) return null;
    if (!a.stops.every((s) => stopOrder.includes(s))) return null;
    if (![1, 2, 3, 4].includes(a.budget)) return null;
    a.stops = stopOrder.filter((s) => a.stops.includes(s));
    a.vibes = Array.isArray(a.vibes) ? a.vibes : [];
    a.partySize = Math.min(Math.max(Number(a.partySize) || 2, 1), 50);
    return a;
  } catch {
    return null;
  }
}
