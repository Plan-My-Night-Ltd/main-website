import { friendlyTime, periodsFor, priceBandLabel, weekdayNames } from "@/lib/format";
import type { Venue } from "@/lib/types";

// The practical details a visitor needs before they go, in a fixed order.
export function VenueFacts({
  venue,
  weekday,
  tone = "onBlack",
}: {
  venue: Venue;
  weekday?: number;
  tone?: "onBlack" | "onLight";
}) {
  const openUntil = (() => {
    if (weekday === undefined) {
      const latest = [...venue.hours].sort((a, b) => lateness(b.closes) - lateness(a.closes))[0];
      return latest ? `${friendlyTime(latest.closes)} at the latest` : "Hours not confirmed";
    }
    const periods = periodsFor(venue.hours, weekday);
    if (periods.length === 0) return `Closed on ${weekdayNames[weekday]}s`;
    return `${friendlyTime(periods[periods.length - 1].closes)} on ${weekdayNames[weekday]}s`;
  })();

  const facts: [string, string][] = [
    ["Nearest Tube", venue.nearestTube],
    ["Price per head", `About £${venue.pricePerHeadGbp} (${priceBandLabel(venue.priceBand)})`],
    ["Dress code", venue.dressCode],
    ["Door policy", venue.doorPolicy],
    ["Open until", openUntil],
    ["Booking", venue.bookingUrl ? "Book ahead" : "Walk-ins only"],
  ];
  const rule = tone === "onBlack" ? "divide-line border-line" : "divide-stone border-stone";
  const muted = tone === "onBlack" ? "text-ash" : "text-ash-deep";

  return (
    <dl className={`divide-y border-y ${rule}`}>
      {facts.map(([term, value]) => (
        <div key={term} className="grid grid-cols-[8.5rem_1fr] gap-4 py-3.5 text-[0.9375rem] sm:grid-cols-[10rem_1fr]">
          <dt className={muted}>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// Closing times after midnight count as later than evening ones.
function lateness(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h < 12 ? h + 24 : h) * 60 + m;
}
