import Link from "next/link";
import { checkAvailability, checkable, timesNear } from "@/lib/booking/availability";
import { bookingTarget } from "@/lib/booking/links";
import { clock, friendlyTime, toMinutes } from "@/lib/format";
import type { PlannedStop } from "@/lib/plan/build";
import type { Venue } from "@/lib/types";

// Live tables for a stop whose venue books through OpenTable, streamed in after
// the plan so the page never waits on it. If the pick is full around arrival,
// it says so and points to alternatives that do have tables.

type Props = {
  stop: PlannedStop;
  date: string;
  partySize: number;
  swapHref: (slug: string) => string;
};

/** Only stops whose pick we can check get a live section at all. */
export function hasLiveTables(stop: PlannedStop): boolean {
  return stop.stop !== "club" && stop.venue !== null && checkable(stop.venue);
}

export function TableAvailabilityLoading() {
  return <p className="mt-4 text-sm text-ash">Checking tables on OpenTable…</p>;
}

export async function TableAvailability({ stop, date, partySize, swapHref }: Props) {
  const pick = stop.venue!;
  const others = stop.alternatives.filter(checkable);
  const live = await checkAvailability([pick, ...others], date, partySize);
  const mine = live.get(pick.slug);
  if (!mine) return null; // check failed or unavailable: the Book button still works

  const people = `${partySize} ${partySize === 1 ? "person" : "people"}`;
  const around = friendlyTime(clock(stop.arrive));
  const near = timesNear(mine, stop.arrive);

  if (mine.status === "not_yet_bookable") {
    return <p className="mt-4 text-sm text-ash">OpenTable isn&apos;t taking bookings for this date yet.</p>;
  }

  if (near.length > 0) {
    return (
      <div className="mt-4">
        <p className="text-sm text-ash">Tables for {people} on OpenTable:</p>
        <TimeChips venue={pick} times={near.slice(0, 4).sort()} date={date} partySize={partySize} />
      </div>
    );
  }

  // Full around arrival: later times that evening, then alternatives with tables.
  const later = mine.times.filter((t) => toMinutes(t) >= toMinutes("17:00")).slice(0, 4);
  const withTables = others
    .map((v) => ({ v, times: live.get(v.slug) ? timesNear(live.get(v.slug)!, stop.arrive) : [] }))
    .filter((o) => o.times.length > 0);

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-white/85">No tables for {people} around {around} on OpenTable.</p>
      {later.length > 0 && (
        <div>
          <p className="text-sm text-ash">Other times that day:</p>
          <TimeChips venue={pick} times={later} date={date} partySize={partySize} />
        </div>
      )}
      {withTables.length > 0 && (
        <p className="text-sm text-ash">
          Tables around {around} at{" "}
          {withTables.map((o, i) => (
            <span key={o.v.slug}>
              {i > 0 && (i === withTables.length - 1 ? " and " : ", ")}
              <Link href={swapHref(o.v.slug)} scroll={false} className="text-white underline underline-offset-4">
                {o.v.name}
              </Link>{" "}
              ({friendlyTime(o.times[0])})
            </span>
          ))}
          .
        </p>
      )}
    </div>
  );
}

function TimeChips({ venue, times, date, partySize }: { venue: Venue; times: string[]; date: string; partySize: number }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {times.map((t) => (
        <li key={t}>
          <a
            href={bookingTarget(venue, { date, time: t, partySize }).href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded-full border border-white/35 px-4 py-1.5 text-sm text-white transition-colors hover:border-white"
          >
            {friendlyTime(t)}
            <span className="sr-only"> at {venue.name} on OpenTable (opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
