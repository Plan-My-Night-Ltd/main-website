import type { OpeningPeriod, VenueType } from "@/lib/types";

export const weekdayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const venueTypeLabel: Record<VenueType, string> = {
  restaurant: "Restaurant",
  bar: "Bar",
  club: "Club",
};

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 1290 -> "21:30"; minutes past midnight wrap (1530 -> "01:30"). */
export function clock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "02:00" -> "2am", "23:30" -> "11.30pm", "00:00" -> "midnight". */
export function friendlyTime(hhmm: string): string {
  const total = toMinutes(hhmm);
  if (total === 0) return "midnight";
  if (total === 720) return "noon";
  const h = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}.${String(m).padStart(2, "0")}${suffix}`;
}

export function priceBandLabel(band: number): string {
  return "£".repeat(band);
}

/** 0 = Monday, matching venue_hours.weekday. */
export function weekdayOf(isoDate: string): number {
  const [y, mo, d] = isoDate.split("-").map(Number);
  return (new Date(Date.UTC(y, mo - 1, d)).getUTCDay() + 6) % 7;
}

export function longDate(isoDate: string): string {
  const [y, mo, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export function periodsFor(hours: OpeningPeriod[], weekday: number): OpeningPeriod[] {
  return hours.filter((p) => p.weekday === weekday).sort((a, b) => toMinutes(a.opens) - toMinutes(b.opens));
}

export function hoursLine(hours: OpeningPeriod[], weekday: number): string {
  const periods = periodsFor(hours, weekday);
  if (periods.length === 0) return "Closed";
  return periods.map((p) => `${friendlyTime(p.opens)} to ${friendlyTime(p.closes)}`).join(", ");
}
