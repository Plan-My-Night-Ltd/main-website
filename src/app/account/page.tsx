import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { removeSavedPlan, setMarketingOptIn } from "@/app/account/actions";
import { NightLine } from "@/components/night-line";
import { button } from "@/components/ui";
import { contactEmail } from "@/lib/contact";
import { londonToday, longDate, venueTypeLabel } from "@/lib/format";
import { decodeAnswers, type Answers, type Stop } from "@/lib/plan/answers";
import { buildPlan, type Plan } from "@/lib/plan/build";
import { shapeLabel, whereLabel } from "@/lib/plan/describe";
import { serverSupabase } from "@/lib/supabase/server";
import type { Venue } from "@/lib/types";
import { getArea, getVenuesBySlugs, listAreas, planCandidates } from "@/lib/venues";

export const metadata: Metadata = {
  title: "Your nights",
  robots: { index: false },
};

type SavedPlan = { id: string; plan_key: string; answers: Answers; night_date: string; area: string; updated_at: string };
type Visit = { venue_slug: string; visited_on: string };
type Booking = { venue_slug: string; night_date: string; stop: Stop | null };
type Profile = { display_name: string | null; marketing_opt_in?: boolean | null };
type Place = { slug: string; date: string; booked: boolean };

function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
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

export default async function AccountPage(props: PageProps<"/account">) {
  const supabase = await serverSupabase();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) redirect("/login?next=/account");

  const tab = (await props.searchParams).tab === "places" ? "places" : "nights";

  const [{ data: profile }, { data: plans }, { data: visits }, { data: bookings }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>(),
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
  const laterNights = upcoming.slice(1);

  // Places they've been: venues they marked as visited, plus venues they booked once the night has passed.
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

  const venues = new Map(
    (await getVenuesBySlugs([...new Set([...places.keys(), ...(bookings ?? []).map((b) => b.venue_slug)])])).map((v) => [
      v.slug,
      v,
    ]),
  );
  const bookedByNight = new Map<string, string[]>();
  for (const b of bookings ?? []) {
    const name = venues.get(b.venue_slug)?.name;
    if (name) bookedByNight.set(b.night_date, [...(bookedByNight.get(b.night_date) ?? []), name]);
  }

  const nextPlan = next ? await safeBuild(next) : null;
  const firstName = (profile?.display_name || (user.user_metadata?.full_name as string | undefined) || "").trim().split(/\s+/)[0];
  const emailsOn = Boolean(profile?.marketing_opt_in);

  const nextLabel = !next ? null : next.night_date === today ? "Tonight" : next.night_date === addDays(today, 1) ? "Tomorrow" : "Your next night";
  const daysAway = next ? Math.round((Date.parse(next.night_date) - Date.parse(today)) / 86_400_000) : 0;
  const intro = next
    ? daysAway === 0
      ? "Your night out is tonight."
      : daysAway === 1
        ? "Your night out is tomorrow."
        : `${daysAway} days until your next night out.`
    : past.length > 0
      ? "Nothing planned yet. Where to next?"
      : "Your first night out is a few questions away.";

  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 pb-16 sm:px-8 sm:pt-16 sm:pb-24">
      <header>
        <h1 className="text-title font-light">
          {greeting()}
          {firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="mt-2 text-ash">{intro}</p>
      </header>

      {next && nextPlan && (
        <NextNight
          label={nextLabel!}
          saved={next}
          plan={nextPlan}
          booked={new Set((bookings ?? []).filter((b) => b.night_date === next.night_date).map((b) => b.venue_slug))}
        />
      )}

      <Link href="/plan" className={`${button.light} mt-6 w-full sm:w-auto`}>
        Plan a night
      </Link>

      <nav aria-label="Your account" className="mt-14 grid grid-cols-2 rounded-full border border-line p-1 text-[0.9375rem]">
        <TabLink href="/account" active={tab === "nights"} count={allPlans.length}>
          Your nights
        </TabLink>
        <TabLink href="/account?tab=places" active={tab === "places"} count={placeList.length}>
          Places you&apos;ve been
        </TabLink>
      </nav>

      {tab === "nights" ? (
        <div className="mt-8">
          {allPlans.length === 0 && (
            <Empty>Every night you plan is saved here, with the venues you mark as booked.</Empty>
          )}
          {next && !nextPlan && <NightList heading="Coming up" plans={upcoming} bookedByNight={bookedByNight} />}
          {nextPlan && laterNights.length > 0 && (
            <NightList heading="Also coming up" plans={laterNights} bookedByNight={bookedByNight} />
          )}
          {nextPlan && laterNights.length === 0 && past.length === 0 && (
            <Empty>Your next night is above. Nights you plan after it will be listed here.</Empty>
          )}
          {past.length > 0 && <NightList heading="Past nights" plans={past} bookedByNight={bookedByNight} past />}
        </div>
      ) : (
        <div className="mt-8">
          {placeList.length === 0 ? (
            <Empty>
              Tap &ldquo;Mark as booked&rdquo; on your plan, and the venue appears here once the night has passed. You can
              also mark places from any venue&apos;s page.
            </Empty>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {placeList.map((p) => (
                <PlaceRow key={p.slug} place={p} venue={venues.get(p.slug)} />
              ))}
            </ul>
          )}
        </div>
      )}

      <section aria-labelledby="settings" className="mt-20">
        <h2 id="settings" className="text-sm text-ash">
          Settings
        </h2>
        <form
          action={setMarketingOptIn.bind(null, !emailsOn)}
          className="mt-3 flex items-center justify-between gap-6 border-y border-line py-4"
        >
          <div>
            <p id="emails-label">Emails from us</p>
            <p className="mt-0.5 text-sm text-ash">
              {emailsOn
                ? "Our pick of London nights, now and then."
                : "Off. We still email you about your account and bookings."}
            </p>
          </div>
          <button
            type="submit"
            role="switch"
            aria-checked={emailsOn}
            aria-labelledby="emails-label"
            className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${
              emailsOn ? "border-white bg-white" : "border-white/35 bg-transparent hover:border-white"
            }`}
          >
            <span
              aria-hidden
              className={`absolute top-1/2 size-5 -translate-y-1/2 rounded-full transition-[left] ${
                emailsOn ? "left-[1.4rem] bg-black" : "left-1 bg-white/70"
              }`}
            />
          </button>
        </form>
      </section>

      {contactEmail && (
        <p className="mt-12 text-sm text-ash">
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

function NextNight({ label, saved, plan, booked }: { label: string; saved: SavedPlan; plan: Plan; booked: Set<string> }) {
  const venueStops = plan.stops.filter((s) => s.venue);
  const bookedCount = venueStops.filter((s) => booked.has(s.venue!.slug)).length;
  return (
    <section aria-labelledby="next-night" className="mt-8 border border-line bg-raised">
      <div className="px-5 pt-6 sm:px-8 sm:pt-8">
        <h2 id="next-night" className="text-sm text-ash">
          {label}
        </h2>
        <p className="mt-1 text-2xl font-light sm:text-3xl">
          {longDate(saved.night_date)} in {whereLabel(saved.area)}
        </p>
        <p className="mt-1 text-sm text-ash">
          {shapeLabel(saved.answers.stops)}, {people(saved.answers.partySize)}
        </p>
      </div>
      <div className="px-5 pt-8 pb-4 sm:px-8">
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
        <p className="text-sm text-ash">
          {bookedCount === 0
            ? "Nothing booked yet"
            : bookedCount === venueStops.length
              ? "All booked"
              : `${bookedCount} of ${venueStops.length} booked`}
        </p>
        <Link href={`/plan/${saved.plan_key}`} className={button.ghost}>
          Open plan
        </Link>
      </div>
    </section>
  );
}

function TabLink({ href, active, count, children }: { href: string; active: boolean; count: number; children: ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-center transition-colors ${
        active ? "bg-white text-black" : "text-white/75 hover:text-white"
      }`}
    >
      {children}
      {count > 0 && <span className={`text-sm ${active ? "text-black/55" : "text-ash"}`}>{count}</span>}
    </Link>
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
            <li key={p.id} className="flex items-center gap-2">
              <Link href={`/plan/${p.plan_key}`} className="group flex min-w-0 flex-1 items-center gap-4 py-4">
                <DateTile iso={p.night_date} muted={past} />
                <span className="min-w-0">
                  <span className="block truncate text-lg font-light underline-offset-[6px] group-hover:underline">
                    {whereLabel(p.area)}
                  </span>
                  <span className="block truncate text-sm text-ash">
                    {shapeLabel(p.answers.stops)}, {people(p.answers.partySize)}
                  </span>
                  {booked && (
                    <span className="mt-1 flex items-center gap-1.5 text-sm text-white/85">
                      <Tick />
                      <span className="truncate">{booked.join(", ")}</span>
                    </span>
                  )}
                </span>
              </Link>
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// The night as a calendar leaf: weekday, day, month.
function DateTile({ iso, muted }: { iso: string; muted?: boolean }) {
  const d = new Date(`${iso}T00:00:00Z`);
  const part = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });
  return (
    <span
      aria-hidden
      className={`flex w-14 shrink-0 flex-col items-center border py-1.5 leading-none ${
        muted ? "border-line text-ash" : "border-white/35 text-white"
      }`}
    >
      <span className="text-[0.6875rem] text-ash">{part({ weekday: "short" })}</span>
      <span className="mt-1 text-2xl font-light">{part({ day: "numeric" })}</span>
      <span className="mt-1 text-[0.6875rem] text-ash">{part({ month: "short" })}</span>
    </span>
  );
}

function PlaceRow({ place, venue }: { place: Place; venue?: Venue }) {
  const date = new Date(`${place.date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return (
    <li>
      <Link href={`/venues/${place.slug}`} className="group flex items-center justify-between gap-4 py-4">
        <span className="min-w-0">
          <span className="block truncate text-lg font-light underline-offset-[6px] group-hover:underline">
            {venue?.name ?? place.slug}
          </span>
          {venue && (
            <span className="block truncate text-sm text-ash">
              {venueTypeLabel[venue.type]} in {getArea(venue.areaSlug)?.name}
            </span>
          )}
        </span>
        <span className="shrink-0 text-right text-sm">
          <span className="block text-white/85">{date}</span>
          <span className="block text-ash">{place.booked ? "Booked" : "Marked as visited"}</span>
        </span>
      </Link>
    </li>
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
