import { platformLabel, type BookingPlatform } from "@/lib/booking/platforms";
import { friendlyTime, venueTypeLabel, weekdayNames } from "@/lib/format";
import { budgetOptions, groupOptions, musicOptions, stopLabel, vibeOptions, type Stop } from "@/lib/plan/answers";
import { shapeLabel, whereLabel } from "@/lib/plan/describe";
import type { VenueType } from "@/lib/types";

// Plain-English names for the codes the database stores.

const find = <T extends { value: unknown; label: string }>(list: T[], v: unknown) => list.find((o) => String(o.value) === String(v));

export const label = {
  group: (k: string | null | undefined) => (k ? (find(groupOptions, k)?.label ?? k) : "Not given"),
  budget: (k: string | number | null | undefined) => {
    const o = find(budgetOptions, k);
    return o ? `${o.label} (${o.hint.toLowerCase()})` : "Not given";
  },
  budgetShort: (k: string | number | null | undefined) => find(budgetOptions, k)?.label ?? "",
  vibe: (k: string) => find(vibeOptions, k)?.label ?? k,
  music: (k: string | null | undefined) => (k ? (find(musicOptions, k)?.label ?? k) : "Not asked"),
  shape: (k: string) => (k ? shapeLabel(k.split(",") as Stop[]) : "Not given"),
  area: (k: string | null | undefined) => (k ? whereLabel(k) : ""),
  weekday: (isoDow: string | number) => weekdayNames[Number(isoDow) - 1] ?? String(isoDow),
  start: (hhmm: string) => (/^\d{2}:\d{2}$/.test(hhmm) ? friendlyTime(hhmm) : hhmm),
  stop: (k: string | null | undefined) => (k && k in stopLabel ? stopLabel[k as Stop] : "Not set"),
  venueType: (k: string | null | undefined) => (k && k in venueTypeLabel ? venueTypeLabel[k as VenueType] : ""),
  platform: (k: string | null | undefined) => {
    if (!k || k === "none") return "No booking link";
    if (k === "other") return "Other booking page";
    return platformLabel[k as BookingPlatform] ?? k;
  },
  /** Where a click went: a booking platform, or the venue's website, or Google Maps. */
  destination: (k: string) => (k === "website" ? "Venue website" : k === "maps" ? "Google Maps" : label.platform(k)),
  source: (k: string) => ({ plan: "Plan: Book button", plan_time: "Plan: table time", venue: "Venue page" })[k] ?? k,
  kind: (k: string) => ({ book: "Booking page", website: "Website", maps: "Google Maps" })[k] ?? k,
  provider: (k: string) => ({ google: "Google", apple: "Apple", email: "Email" })[k] ?? k,
};

export { day, dayTime, num, pct } from "@/components/control-center/fmt";
