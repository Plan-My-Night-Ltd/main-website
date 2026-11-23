import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { CopyLinkButton } from "@/components/copy-link-button";
import { EmailOptIn } from "@/components/email-opt-in";
import { NightLine } from "@/components/night-line";
import { PhotoHero } from "@/components/photo-hero";
import { SavePlan } from "@/components/save-plan";
import { SignupGate } from "@/components/signup-gate";
import { hasLiveTables, TableAvailability, TableAvailabilityLoading } from "@/components/table-availability";
import { button } from "@/components/ui";
import { VisitedToggle } from "@/components/visited-toggle";
import { bookingFact, bookingTarget, type BookingRequest } from "@/lib/booking/links";
import { clock, friendlyTime, londonToday, longDate, priceBandLabel, priceLine } from "@/lib/format";
import { decodeAnswers, encodeAnswers, stopLabel, type Answers } from "@/lib/plan/answers";
import { buildPlan, type PlannedStop } from "@/lib/plan/build";
import { searchKey, whereLabel } from "@/lib/plan/describe";
import { isSharedLink, sharePath } from "@/lib/plan/share";
import { photo, type Photo } from "@/lib/photos";
import { authConfigured } from "@/lib/supabase/env";
import { serverSupabase } from "@/lib/supabase/server";
import type { Venue } from "@/lib/types";
import { getArea, listAreas, planCandidates, usingSampleData } from "@/lib/venues";

export const metadata: Metadata = {
  title: "Your night",
  robots: { index: false },
};

// Who is looking at the plan: the signed-in person (if any), and whether we still
// need to ask them about emails. If the profile can't be read, we don't ask.
async function planViewer() {
  const supabase = await serverSupabase();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) return { user: null, askAboutEmails: false };
  const { data } = await supabase.from("profiles").select("marketing_opt_in").eq("id", user.id).maybeSingle();
  return { user, askAboutEmails: data != null && data.marketing_opt_in === null };
}

export default async function PlanResultPage(props: PageProps<"/plan/[id]">) {
  const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  const answers = decodeAnswers(id);
  if (!answers) notFound();

  const [candidates, viewer] = await Promise.all([planCandidates(answers), planViewer()]);
  const plan = buildPlan(answers, candidates, listAreas(), londonToday());
  const filledStops = plan.stops.filter((s) => s.venue);
  const hasAnyVenue = filledStops.length > 0;
  const firstVenueArea = filledStops[0]?.venue?.areaSlug;
  const heroPhoto = photo(getArea(answers.area) ? answers.area : (firstVenueArea ?? "hero-street"));
  const swapHref = (stop: PlannedStop, slug: string) => {
    const swapped: Answers = { ...answers, swaps: { ...answers.swaps, [stop.stop]: slug } };
    return `/plan/${encodeAnswers(swapped)}`;
  };

  // Signed-out guests see an outline of the night and a sign-up pop-up, unless a
  // friend shared the plan with them. The venues themselves never reach their browser.
  // An empty plan isn't worth signing up for, so that shows as normal.
  const locked = authConfigured && !viewer.user && hasAnyVenue && !isSharedLink(id, query.s);

  if (locked) {
    const count = filledStops.length;
    const summary = `${count} ${count === 1 ? "stop" : "stops"} in ${whereLabel(answers.area)} on ${longDate(answers.date)}, from ${friendlyTime(clock(filledStops[0].arrive))}.`;
    return (
      <>
        <PlanHero answers={answers} heroPhoto={heroPhoto} />
        <div className="mx-auto max-w-7xl px-4 pt-16 pb-24 sm:px-8 sm:pt-20 sm:pb-32">
          <PlanTeaser stops={filledStops} />
        </div>
        <SignupGate next={`/plan/${id}`} summary={summary} editHref={`/plan?edit=${id}`} />
      </>
    );
  }

  return (
    <>
      <PlanHero answers={answers} heroPhoto={heroPhoto}>
        <div className="mt-8 flex flex-wrap gap-3">
          <CopyLinkButton path={sharePath(id)} />
          <Link href={`/plan?edit=${id}`} className={button.ghost}>
            Change answers
          </Link>
        </div>
        <div className="mt-5 min-h-5 space-y-2">
          <SavePlan planKey={id} searchKey={searchKey(answers)} answers={answers} />
          {viewer.askAboutEmails && <EmailOptIn />}
        </div>
      </PlanHero>

      <div className="mx-auto grid max-w-7xl gap-16 px-4 pt-16 pb-24 sm:px-8 sm:pt-20 sm:pb-32 lg:grid-cols-[1.4fr_1fr] lg:gap-24">
        <section aria-label="Itinerary">
          <NightLine
            stops={plan.stops}
            renderDetails={(s) => (
              <div className="mt-4 max-w-xl">
                {s.reason && <p className="font-light text-white/85">{s.reason}</p>}
                {stopFacts(s.venue!) && <p className="mt-3 text-sm text-ash">{stopFacts(s.venue!)}</p>}
                <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-4">
                  <BookingLink venue={s.venue!} request={{ date: answers.date, time: clock(s.arrive), partySize: answers.partySize }} />
                  <VisitedToggle venueSlug={s.venue!.slug} />
                </div>
                {hasLiveTables(s) && (
                  <Suspense fallback={<TableAvailabilityLoading />}>
                    <TableAvailability
                      stop={s}
                      date={answers.date}
                      partySize={answers.partySize}
                      swapHref={(slug) => swapHref(s, slug)}
                    />
                  </Suspense>
                )}
                {s.alternatives.length > 0 && (
                  <details className="group mt-4">
                    <summary className="inline-flex cursor-pointer items-center gap-2 text-sm text-white/75 underline underline-offset-4 hover:text-white">
                      Swap {stopLabel[s.stop].toLowerCase()}
                    </summary>
                    <ul className="mt-4 divide-y divide-line border-y border-line">
                      {s.alternatives.map((alt) => (
                        <li key={alt.slug}>
                          <Link href={swapHref(s, alt.slug)} scroll={false} className="group/alt block py-4">
                            <span className="text-lg font-light underline-offset-[6px] group-hover/alt:underline">
                              {alt.name}
                            </span>
                            <span className="mt-0.5 block text-sm text-ash">
                              {[getArea(alt.areaSlug)?.name, priceLine(alt)?.toLowerCase()].filter(Boolean).join(", ")}.{" "}
                              {alt.description}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
            renderEmpty={() => (
              <p className="mt-1 max-w-md text-ash">
                Nothing we&apos;ve checked fits this slot yet.{" "}
                <Link href={`/plan?edit=${id}`} className="text-white underline underline-offset-4">
                  Try another area or budget
                </Link>
                .
              </p>
            )}
          />
          <p className="text-sm text-ash">
            Times include travel between stops. Walking times are estimates.
            {!usingSampleData && " Venue details come from Foursquare unless we've checked the place ourselves."}
          </p>
        </section>

        {!hasAnyVenue && (
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <div className="border border-line p-6 sm:p-9">
              <h2 className="text-2xl font-light">We couldn&apos;t fill this night yet</h2>
              <p className="mt-3 text-ash">Our list is still growing. A wider area or budget usually finds something.</p>
              <Link href={`/plan?edit=${id}`} className={`${button.light} mt-6`}>
                Change answers
              </Link>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}

function PlanHero({ answers, heroPhoto, children }: { answers: Answers; heroPhoto?: Photo; children?: ReactNode }) {
  return (
    <PhotoHero photo={heroPhoto} height="short">
      <h1 className="text-display font-light">Your night</h1>
      <p className="mt-4 text-lg font-light text-white/80">
        {longDate(answers.date)} in {whereLabel(answers.area)}. {answers.partySize}{" "}
        {answers.partySize === 1 ? "person" : "people"},{" "}
        <span className="whitespace-nowrap">{priceBandLabel(answers.budget)}</span>.
      </p>
      {children}
    </PhotoHero>
  );
}

// The shape of the night behind the sign-up pop-up: real times and stop types,
// blurred bars where the venues go. Deliberately contains no venue details.
function PlanTeaser({ stops }: { stops: PlannedStop[] }) {
  const cols = "grid grid-cols-[4.25rem_1.25rem_1fr] gap-x-3 sm:grid-cols-[5rem_1.25rem_1fr] sm:gap-x-4";
  return (
    <ol aria-hidden className="pointer-events-none max-w-3xl select-none">
      {stops.map((s, i) => (
        <li key={s.stop} className={cols}>
          <time className="pt-0.5 text-right text-[0.9375rem] font-light sm:text-base">{friendlyTime(clock(s.arrive))}</time>
          <span className="flex flex-col items-center">
            <span className="mt-2 size-3 shrink-0 rounded-full border border-white bg-black" />
            {i < stops.length - 1 && <span className="w-px flex-1 bg-white/70" />}
          </span>
          <div className="pb-14">
            <p className="text-sm text-ash">{stopLabel[s.stop]}</p>
            <div className="mt-2 h-8 w-[min(18rem,80%)] rounded-full bg-white/25 blur-md" />
            <div className="mt-3 h-4 w-[min(12rem,60%)] rounded-full bg-white/10 blur-md" />
            <div className="mt-5 h-16 max-w-xl rounded bg-white/5 blur-lg" />
          </div>
        </li>
      ))}
    </ol>
  );
}

// Booking goes straight to the venue: its booking page with the night filled in if
// we know it, otherwise its own website, otherwise Google Maps so people can still find it.
function BookingLink({ venue, request }: { venue: Venue; request: BookingRequest }) {
  const target = bookingTarget(venue, venue.type === "club" ? undefined : request);
  return (
    <a href={target.href} target="_blank" rel="noopener noreferrer" className={target.kind === "maps" ? button.ghost : button.light}>
      {target.label}
      <span className="sr-only"> for {venue.name} (opens in a new tab)</span>
    </a>
  );
}

// "About £55 a head. Smart casual. Book ahead." Only what's known about the venue.
function stopFacts(venue: Venue): string {
  return [priceLine(venue), venue.dressCode, bookingFact(venue)]
    .filter(Boolean)
    .map((f) => `${f}.`)
    .join(" ");
}
