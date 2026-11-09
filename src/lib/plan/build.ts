import { friendlyTime, clock, toMinutes, weekdayOf } from "@/lib/format";
import { groupOptions, stopOrder, vibeOptions, type Answers, type Stop } from "@/lib/plan/answers";
import type { Area, Venue, VenueType } from "@/lib/types";

// The matching engine: hard filters, tag scoring, then itinerary timing. Runs on
// the shortlist from planCandidates() in venues.ts. Claude reranking slots in later.

export const stopVenueType: Record<Stop, VenueType> = { dinner: "restaurant", drinks: "bar", club: "club" };

// How long each stop usually lasts, and the minimum time a venue must stay open after arrival.
const stay: Record<Stop, number> = { dinner: 120, drinks: 105, club: 180 };
const minOpenAfterArrival: Record<Stop, number> = { dinner: 90, drinks: 60, club: 90 };
const clubsFillFrom = toMinutes("22:30");
export const maxHopKm = 3;
export const areaRadiusKm = 1.8;
const alternativesShown = 3;

export type Travel = { mode: "walk" | "ride"; minutes: number; km: number };

export type PlannedStop = {
  stop: Stop;
  arrive: number; // minutes from midnight on the night; can pass 1440
  venue: Venue | null;
  leave?: number;
  closes?: number;
  reason?: string;
  travel?: Travel;
  alternatives: Venue[];
};

export type Plan = {
  answers: Answers;
  weekday: number;
  stops: PlannedStop[];
};

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Estimate until real routing is wired in: streets add ~30% over a straight line,
// walking at 4.8 km/h; beyond 1.6 km assume a Tube or cab hop.
export function estimateTravel(a: Venue, b: Venue): Travel {
  const km = distanceKm(a, b);
  if (km <= 1.6) return { mode: "walk", km, minutes: Math.max(2, Math.round(((km * 1.3) / 4.8) * 60)) };
  return { mode: "ride", km, minutes: Math.round(10 + km * 3) };
}

/** Closing time (minutes on the night) if the venue is open at `arrive` for at least `minStay`, else null. */
export function closingTimeIfOpen(venue: Venue, weekday: number, arrive: number, minStay: number): number | null {
  for (const p of venue.hours) {
    if (p.weekday !== weekday) continue;
    const opens = toMinutes(p.opens);
    let closes = toMinutes(p.closes);
    if (closes <= opens) closes += 1440;
    if (arrive >= opens && arrive + minStay <= closes) return closes;
  }
  return null;
}

function inChosenArea(venue: Venue, answers: Answers, areas: Area[]): boolean {
  if (answers.area === "anywhere") return true;
  if (answers.area.startsWith("region:")) {
    const region = answers.area.slice("region:".length);
    return areas.find((a) => a.slug === venue.areaSlug)?.region === region;
  }
  if (venue.areaSlug === answers.area) return true;
  const centre = areas.find((a) => a.slug === answers.area);
  return centre ? distanceKm(venue, centre) <= areaRadiusKm : false;
}

function score(venue: Venue, stop: Stop, answers: Answers, prev: Venue | null): number {
  const groupTags = groupOptions.find((g) => g.value === answers.group)?.tags ?? [];
  let s = 0;
  s += 3 * venue.vibeTags.filter((t) => answers.vibes.includes(t)).length;
  s += 2 * venue.vibeTags.filter((t) => groupTags.includes(t)).length;
  if (stop !== "dinner" && answers.music !== "any") {
    if (venue.musicTags.includes(answers.music)) s += 4;
    else if (stop === "club") s -= 2;
  }
  if (venue.priceBand === answers.budget) s += 3;
  if (venue.areaSlug === answers.area) s += 3;
  if (venue.verified) s += 2;
  if (venue.rating !== undefined) s += 1.5 * (venue.rating - 7.5);
  if (prev) s -= 1.5 * distanceKm(prev, venue);
  return s;
}

function reasonFor(venue: Venue, stop: Stop, answers: Answers, closes: number, travel?: Travel): string {
  const vibeLabels = venue.vibeTags
    .filter((t) => answers.vibes.includes(t))
    .map((t) => vibeOptions.find((v) => v.value === t)?.label.toLowerCase())
    .filter(Boolean) as string[];
  const parts: string[] = [];
  if (vibeLabels.length) parts.push(capitalise(vibeLabels.slice(0, 2).join(" and ")));
  if (stop !== "dinner" && answers.music !== "any" && venue.musicTags.includes(answers.music)) {
    parts.push("plays what you asked for");
  }
  if (venue.rating !== undefined && venue.rating >= 8.5) parts.push(`rated ${venue.rating.toFixed(1)} out of 10 on Foursquare`);
  if (travel) parts.push(travel.mode === "walk" ? `${travel.minutes} minutes' walk from your last stop` : "a short ride from your last stop");
  parts.push(`open until ${friendlyTime(clock(closes))}`);
  return capitalise(parts.join(", ")) + ".";
}

function roundUpToFive(minutes: number): number {
  return Math.ceil(minutes / 5) * 5;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function buildPlan(answers: Answers, venues: Venue[], areas: Area[]): Plan {
  const weekday = weekdayOf(answers.date);
  const stops: PlannedStop[] = [];
  let prev: Venue | null = null;
  let clockNow = toMinutes(answers.start);

  for (const stop of stopOrder.filter((s) => answers.stops.includes(s))) {
    const earliest = stop === "club" ? Math.max(clockNow, clubsFillFrom) : clockNow;

    const ranked = venues
      .filter((v) => v.type === stopVenueType[stop])
      .filter((v) => v.priceBand === undefined || Math.abs(v.priceBand - answers.budget) <= 1)
      .filter((v) => inChosenArea(v, answers, areas) || (prev !== null && distanceKm(prev, v) <= maxHopKm))
      .map((v) => {
        const travel: Travel | undefined = prev ? estimateTravel(prev, v) : undefined;
        const arrive = roundUpToFive(earliest + (travel?.minutes ?? 0));
        const closes = closingTimeIfOpen(v, weekday, arrive, minOpenAfterArrival[stop]);
        return { v, travel, arrive, closes, s: score(v, stop, answers, prev) };
      })
      .filter((c): c is typeof c & { closes: number } => c.closes !== null)
      .sort((a, b) => b.s - a.s || a.v.name.localeCompare(b.v.name));

    const swapped = answers.swaps?.[stop];
    const pick = ranked.find((c) => c.v.slug === swapped) ?? ranked[0];

    if (!pick) {
      stops.push({ stop, arrive: earliest, venue: null, alternatives: [] });
      continue;
    }

    const leave = Math.min(pick.arrive + stay[stop], pick.closes);
    stops.push({
      stop,
      arrive: pick.arrive,
      venue: pick.v,
      leave,
      closes: pick.closes,
      travel: pick.travel,
      reason: reasonFor(pick.v, stop, answers, pick.closes, pick.travel),
      alternatives: ranked.filter((c) => c !== pick).slice(0, alternativesShown).map((c) => c.v),
    });
    prev = pick.v;
    clockNow = leave;
  }

  return { answers, weekday, stops };
}
