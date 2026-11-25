import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { removeSavedPlan } from "@/app/account/actions";
import { AccountTabs } from "@/components/account-tabs";
import { AreaTile } from "@/components/area-tile";
import { NightLine } from "@/components/night-line";
import { button } from "@/components/ui";
import { contactEmail } from "@/lib/contact";
import { launchAreaSlugs } from "@/lib/data/areas";
import { londonToday, longDate, venueTypeLabel } from "@/lib/format";
import { decodeAnswers, type Answers, type Stop } from "@/lib/plan/answers";
import { buildPlan, type Plan } from "@/lib/plan/build";
import { shapeLabel, whereLabel } from "@/lib/plan/describe";
import { photo, type Photo } from "@/lib/photos";
import { serverSupabase } from "@/lib/supabase/server";
import type { Area, Venue } from "@/lib/types";
import { getArea, getVenuesBySlugs, listAreas, planCandidates } from "@/lib/venues";

export const metadata: Metadata = {
  title: "Your nights",
  robots: { index: false },
};

type SavedPlan = { id: string; plan_key: string; answers: Answers; night_date: string; area: string; updated_at: string };
type Visit = { venue_slug: string; visited_on: string };
type Booking = { venue_slug: string; night_date: string; stop: Stop | null };
type Place = { slug: string; date: string; booked: boolean };

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/London" }).format(new Date()),
  );
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function people(n: number): string {
  return `${n} ${n === 1 ? "person" : "people"}`;
}

function shortDate(iso: string, withYear = false): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: withYear ? undefined : "short",
    day: "numeric",
    month: "short",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

/** A plan's area as a photo: the neighbourhood itself, or a London street for "anywhere" and regions. */
function areaPhoto(area: string): Photo | undefined {
  return photo(getArea(area) ? area : "hero-street");
}

export default async function AccountPage(props: PageProps<"/account">) {
  const supabase = await serverSupabase();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) redirect("/login?next=/account");

  const initialTab = (await props.searchParams).tab === "places" ? "places" : "nights";

  const [{ data: profile }, { data: plans }, { data: visits }, { data: bookings }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle<{ display_name: string | null }>(),
    supabase
      .from("saved_plans")
      .select("id, plan_key, answers, night_date, area, updated_at")
      .order("night_date", { ascending: false })
      .limit(50)
      .returns<SavedPlan[]>(),
    supabase.from("visits").select("venue_slug, visited_on").returns<Visit[]>(),
    supabase.from("bookings").select("venue_slug, night_date, stop").returns<Booking[]>(),
  ]);

  const today = londonToday();
  const allPlans = plans ?? [];
  const upcoming = allPlans.filter((p) => p.night_date >= today).reverse();
  const past = allPlans.filter((p) => p.night_date < today);
  const next = upcoming[0];

  // Places they've been: venues marked as visited, plus venues booked once the night has passed.
  const places = new Map<string, Place>();
  for (const v of visits ?? []) places.set(v.venue_slug, { slug: v.venue_slug, date: v.visited_on, booked: false });
  for (const b of (bookings ?? []).filter((b) => b.night_date < today)) {
    const known = places.get(b.venue_slug);
    places.set(b.venue_slug, {
      slug: b.venue_slug,
      date: known && known.date > b.night_date ? known.date : b.night_date,
      booked: true,
    });
  }
  const placeList = [...places.values()].sort((a, b) => b.date.localeCompare(a.date));

  const [venueList, nextPlan] = await Promise.all([
    getVenuesBySlugs([...new Set([...places.keys(), ...(bookings ?? []).map((b) => b.venue_slug)])]),
    next ? safeBuild(next) : null,
  ]);
  const venues = new Map(venueList.map((v) => [v.slug, v]));
  const bookedByNight = new Map<string, string[]>();
  for (const b of bookings ?? []) {
    const name = venues.get(b.venue_slug)?.name;
    if (name) bookedByNight.set(b.night_date, [...(bookedByNight.get(b.night_date) ?? []), name]);
  }

  // Your London: neighbourhoods they've actually been out in, and where to try next
  // (their usual part of town first, then our launch neighbourhoods).
  const areas = listAreas();
  const explored = new Set(
    placeList.map((p) => venues.get(p.slug)?.areaSlug).filter((slug): slug is string => Boolean(slug && getArea(slug))),
  );
  const usualRegion = getArea(allPlans[0]?.area ?? "")?.region;
  const rank = (a: Area) => (a.region === usualRegion ? 0 : 2) + (launchAreaSlugs.includes(a.slug) ? 0 : 1);
  const planned = new Set(allPlans.map((p) => p.area));
  const suggestions = areas
    .filter((a) => !explored.has(a.slug) && !planned.has(a.slug))
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, 8);

  const firstName = (profile?.display_name || (user.user_metadata?.full_name as string | undefined) || "").trim().split(/\s+/)[0];
  const daysAway = next ? daysBetween(today, next.night_date) : 0;
  const whenLabel = daysAway === 0 ? "Tonight" : daysAway === 1 ? "Tomorrow" : `In ${daysAway} days`;
  const intro = next
    ? daysAway === 0
      ? "Your night out is tonight."
      : daysAway === 1
        ? "Your night out is tomorrow."
        : `${daysAway} days until your next night out.`
    : past.length > 0
      ? "Nothing planned yet. Where to next?"
      : "Your first night out is a few questions away.";

  const nightsPanel = (
    <>
      {allPlans.length === 0 && <Empty>Every night you plan is saved here, with the venues you mark as booked.</Empty>}
      {upcoming.length > (nextPlan ? 1 : 0) && (
        <NightList
          heading={nextPlan ? "Also coming up" : "Coming up"}
          plans={nextPlan ? upcoming.slice(1) : upcoming}
          bookedByNight={bookedByNight}
        />
      )}
      {nextPlan && upcoming.length === 1 && past.length === 0 && (
        <Empty>Your next night is above. Nights you plan after it are listed here.</Empty>
      )}
      {past.length > 0 && <NightList heading="Past nights" plans={past} bookedByNight={bookedByNight} past />}
    </>
  );

  const placesPanel =
    placeList.length === 0 ? (
      <Empty>
        Tap &ldquo;Mark as booked&rdquo; on your plan and the venue appears here once the night has passed. You can also
        mark places from any venue&apos;s page.
      </Empty>
    ) : (
      <ul className="divide-y divide-line border-y border-line">
        {placeList.map((p) => (
          <PlaceRow key={p.slug} place={p} venue={venues.get(p.slug)} />
        ))}
      </ul>
    );

  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 pb-16 sm:px-8 sm:pt-16 sm:pb-24">
      <header>
        <h1 className="text-title font-light">
          {greeting()}
          {firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="mt-2 text-ash">{intro}</p>
      </header>

      {next && nextPlan ? (
        <>
          <NextNight
            when={whenLabel}
            saved={next}
            plan={nextPlan}
            booked={new Set((bookings ?? []).filter((b) => b.night_date === next.night_date).map((b) => b.venue_slug))}
          />
          <Link href="/plan" className={`${button.light} mt-6 w-full sm:w-auto`}>
            Plan a night
          </Link>
        </>
      ) : (
        <PlanPrompt suggestion={suggestions[0]} />
      )}

      <div className="mt-14">
        <AccountTabs
          initial={initialTab}
          tabs={[
            { id: "nights", label: "Your nights", count: allPlans.length, content: nightsPanel },
            { id: "places", label: "Places you've been", count: placeList.length, content: placesPanel },
          ]}
        />
      </div>

      <YourLondon exploredCount={explored.size} total={areas.length} suggestions={suggestions} />

      {contactEmail && (
        <p className="mt-16 border-t border-line pt-6 text-sm text-ash">
          Questions about a booking or your account?{" "}
          <a href={`mailto:${contactEmail}`} className="text-white/85 underline underline-offset-4 hover:text-white">
            Email us
          </a>
          .
        </p>
      )}
    </div>
  );
}

// The next night is rebuilt from its saved answers so it shows the venues as they
// are now. If that fails (say, the venue list is briefly unavailable), the
// dashboard still loads and the night appears in the list instead.
async function safeBuild(saved: SavedPlan): Promise<Plan | null> {
  try {
    const answers = decodeAnswers(saved.plan_key) ?? saved.answers;
    const plan = buildPlan(answers, await planCandidates(answers), listAreas(), londonToday());
    return plan.stops.some((s) => s.venue) ? plan : null;
  } catch {
    return null;
  }
}

function NextNight({ when, saved, plan, booked }: { when: string; saved: SavedPlan; plan: Plan; booked: Set<string> }) {
  const venueStops = plan.stops.filter((s) => s.venue);
  const bookedCount = venueStops.filter((s) => booked.has(s.venue!.slug)).length;
  const p = areaPhoto(saved.area);
  return (
    <section aria-labelledby="next-night" className="mt-8 overflow-hidden border border-line bg-raised">
      <div className="relative isolate flex h-48 items-end sm:h-60">
        {p && <Image src={p.src} alt="" fill priority sizes="(min-width: 768px) 48rem, 100vw" className="photo -z-10 object-cover" />}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-raised via-raised/55 to-black/10" />
        <div className="px-5 pb-5 sm:px-8 sm:pb-6">
          <p className="text-sm text-white/75">{when}</p>
          <h2 id="next-night" className="mt-0.5 text-2xl font-light sm:text-3xl">
            {longDate(saved.night_date)} in {whereLabel(saved.area)}
          </h2>
          <p className="mt-1 text-sm text-white/75">
            {shapeLabel(saved.answers.stops)}, {people(saved.answers.partySize)}
          </p>
        </div>
      </div>
      <div className="px-5 pt-7 pb-4 sm:px-8">
        <NightLine
          stops={plan.stops}
          size="compact"
          renderDetails={(s) =>
            booked.has(s.venue!.slug) ? (
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-white">
                <Tick />
                Booked
              </p>
            ) : null
          }
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-5 py-4 sm:px-8">
        <BookedMeter booked={bookedCount} total={venueStops.length} />
        <Link href={`/plan/${saved.plan_key}`} className={button.ghost}>
          Open plan
        </Link>
      </div>
    </section>
  );
}

// One short bar per venue, filled in once it's booked.
function BookedMeter({ booked, total }: { booked: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex gap-1" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-1 w-5 rounded-full ${i < booked ? "bg-white" : "bg-white/20"}`} />
        ))}
      </span>
      <span className="text-sm text-ash">
        {booked === 0 ? "Nothing booked yet" : booked === total ? "All booked" : `${booked} of ${total} booked`}
      </span>
    </div>
  );
}

// No night coming up: a photo card that starts the next one.
function PlanPrompt({ suggestion }: { suggestion?: Area }) {
  const p = (suggestion && photo(suggestion.slug)) ?? photo("hero-street");
  return (
    <section aria-labelledby="plan-next" className="mt-8 overflow-hidden border border-line bg-raised">
      <div className="relative isolate flex h-44 items-end sm:h-56">
        {p && <Image src={p.src} alt="" fill priority sizes="(min-width: 768px) 48rem, 100vw" className="photo -z-10 object-cover" />}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-raised via-raised/55 to-black/10" />
        <h2 id="plan-next" className="px-5 pb-4 text-2xl font-light sm:px-8 sm:pb-5 sm:text-3xl">
          Plan your next night
        </h2>
      </div>
      <div className="px-5 pb-6 sm:px-8 sm:pb-8">
        <p className="max-w-sm text-ash">Dinner, drinks and dancing, in the right order. A minute of questions.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/plan" className={button.light}>
            Plan a night
          </Link>
          {suggestion && (
            <Link href={`/plan?area=${suggestion.slug}`} className={button.ghost}>
              Try {suggestion.name}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function NightList({
  heading,
  plans,
  bookedByNight,
  past = false,
}: {
  heading: string;
  plans: SavedPlan[];
  bookedByNight: Map<string, string[]>;
  past?: boolean;
}) {
  return (
    <div className="mt-10 first:mt-0">
      <h3 className="text-sm text-ash">{heading}</h3>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {plans.map((p) => {
          const booked = bookedByNight.get(p.night_date);
          return (
            <li key={p.id} className="flex items-center gap-3">
              <Link href={`/plan/${p.plan_key}`} className="group flex min-w-0 flex-1 items-center gap-4 py-3">
                <Thumb photo={areaPhoto(p.area)} dim={past} />
                <span className="min-w-0">
                  <span className="block text-sm text-ash">{shortDate(p.night_date)}</span>
                  <span className="block truncate text-lg leading-snug font-light underline-offset-[6px] group-hover:underline">
                    {whereLabel(p.area)}
                  </span>
                  <span className="block truncate text-sm text-ash">
                    {shapeLabel(p.answers.stops)}, {people(p.answers.partySize)}
                  </span>
                  {booked && (
                    <span className="mt-0.5 flex items-center gap-1.5 text-sm text-white/85">
                      <Tick />
                      <span className="truncate">{booked.join(", ")}</span>
                    </span>
                  )}
                </span>
              </Link>
              {past ? (
                <Link
                  href={`/plan?edit=${p.plan_key}`}
                  className="shrink-0 rounded-full border border-white/35 px-3.5 py-1.5 text-sm text-white transition-colors hover:border-white"
                >
                  Plan again
                </Link>
              ) : (
                <form action={removeSavedPlan}>
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    aria-label={`Remove ${longDate(p.night_date)} in ${whereLabel(p.area)}`}
                    className="flex size-11 items-center justify-center text-ash transition-colors hover:text-white"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
                    </svg>
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PlaceRow({ place, venue }: { place: Place; venue?: Venue }) {
  return (
    <li>
      <Link href={`/venues/${place.slug}`} className="group flex items-center gap-4 py-3">
        <Thumb photo={venue ? areaPhoto(venue.areaSlug) : undefined} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg leading-snug font-light underline-offset-[6px] group-hover:underline">
            {venue?.name ?? place.slug}
          </span>
          {venue && (
            <span className="block truncate text-sm text-ash">
              {venueTypeLabel[venue.type]} in {getArea(venue.areaSlug)?.name}
            </span>
          )}
          <span className="mt-0.5 flex items-center gap-1.5 text-sm text-white/85">
            {place.booked && <Tick />}
            {place.booked ? "Booked" : "Visited"}, {shortDate(place.date, true)}
          </span>
        </span>
      </Link>
    </li>
  );
}

function YourLondon({ exploredCount, total, suggestions }: { exploredCount: number; total: number; suggestions: Area[] }) {
  return (
    <section aria-labelledby="your-london" className="mt-20">
      <h2 id="your-london" className="text-title font-light">
        Your London
      </h2>
      <p className="mt-2 text-ash">
        {exploredCount === 0
          ? "Mark venues as booked, and the neighbourhoods you've been out in add up here."
          : `You've been out in ${exploredCount} of ${total} neighbourhoods.`}
      </p>
      <div
        className="mt-5 h-px bg-line"
        role="meter"
        aria-label="Neighbourhoods you've been out in"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={exploredCount}
      >
        <div className="h-px bg-white" style={{ width: `${(exploredCount / total) * 100}%` }} />
      </div>

      {suggestions.length > 0 && (
        <>
          <h3 className="mt-10 text-sm text-ash">{exploredCount === 0 ? "Where to start" : "Somewhere new"}</h3>
          <ul className="no-scrollbar -mx-4 mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 scroll-px-4 sm:-mx-8 sm:px-8 sm:scroll-px-8">
            {suggestions.map((a) => (
              <li key={a.slug} className="w-40 shrink-0 snap-start sm:w-48">
                <AreaTile area={a} href={`/plan?area=${a.slug}`} note="Plan a night here" sizes="12rem" />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Thumb({ photo: p, dim }: { photo?: Photo; dim?: boolean }) {
  return (
    <span className="relative size-16 shrink-0 overflow-hidden bg-raised" aria-hidden>
      {p && <Image src={p.src} alt="" fill sizes="64px" className={`photo object-cover ${dim ? "opacity-60" : ""}`} />}
    </span>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="max-w-md text-ash">{children}</p>;
}

function Tick() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
      <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
