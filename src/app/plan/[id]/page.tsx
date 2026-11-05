import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyLinkButton } from "@/components/copy-link-button";
import { EnquiryForm } from "@/components/enquiry-form";
import { NightLine } from "@/components/night-line";
import { PhotoHero } from "@/components/photo-hero";
import { SavePlan } from "@/components/save-plan";
import { button } from "@/components/ui";
import { VisitedToggle } from "@/components/visited-toggle";
import { longDate, priceBandLabel } from "@/lib/format";
import { decodeAnswers, encodeAnswers, stopLabel, type Answers } from "@/lib/plan/answers";
import { buildPlan, type PlannedStop } from "@/lib/plan/build";
import { searchKey, whereLabel } from "@/lib/plan/describe";
import { photo } from "@/lib/photos";
import { getArea, listAreas, listVenues } from "@/lib/venues";

export const metadata: Metadata = {
  title: "Your night",
  robots: { index: false },
};

export default async function PlanResultPage(props: PageProps<"/plan/[id]">) {
  const { id } = await props.params;
  const answers = decodeAnswers(id);
  if (!answers) notFound();

  const plan = buildPlan(answers, listVenues(), listAreas());
  const hasAnyVenue = plan.stops.some((s) => s.venue);
  const firstVenueArea = plan.stops.find((s) => s.venue)?.venue?.areaSlug;
  const heroPhoto = photo(getArea(answers.area) ? answers.area : (firstVenueArea ?? "hero-street"));
  const swapHref = (stop: PlannedStop, slug: string) => {
    const swapped: Answers = { ...answers, swaps: { ...answers.swaps, [stop.stop]: slug } };
    return `/plan/${encodeAnswers(swapped)}`;
  };

  return (
    <>
      <PhotoHero photo={heroPhoto} height="short">
        <h1 className="text-display font-light">Your night</h1>
        <p className="mt-4 text-lg font-light text-white/80">
          {longDate(answers.date)} in {whereLabel(answers.area)}. {answers.partySize}{" "}
          {answers.partySize === 1 ? "person" : "people"},{" "}
          <span className="whitespace-nowrap">{priceBandLabel(answers.budget)}</span>.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <CopyLinkButton />
          <Link href={`/plan?edit=${id}`} className={button.ghost}>
            Change answers
          </Link>
        </div>
        <div className="mt-5 min-h-5">
          <SavePlan planKey={id} searchKey={searchKey(answers)} answers={answers} />
        </div>
      </PhotoHero>

      <div className="mx-auto grid max-w-7xl gap-16 px-4 pt-16 sm:px-8 sm:pt-20 lg:grid-cols-[1.4fr_1fr] lg:gap-24">
        <section aria-label="Itinerary">
          <NightLine
            stops={plan.stops}
            renderDetails={(s) => (
              <div className="mt-4 max-w-xl">
                {s.reason && <p className="font-light text-white/85">{s.reason}</p>}
                <p className="mt-3 text-sm text-ash">
                  About £{s.venue!.pricePerHeadGbp} a head. {s.venue!.dressCode}.{" "}
                  {s.venue!.bookingUrl ? "Book ahead." : "Walk-ins only."}
                </p>
                <div className="mt-4">
                  <VisitedToggle venueSlug={s.venue!.slug} />
                </div>
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
                              {getArea(alt.areaSlug)?.name}, about £{alt.pricePerHeadGbp} a head. {alt.description}
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
          <p className="text-sm text-ash">Times include travel between stops. Walking times are estimates.</p>
        </section>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          {hasAnyVenue ? (
            <div className="bg-bone p-6 text-black sm:p-9">
              <h2 className="text-3xl font-light">Shall we book it?</h2>
              <p className="mt-3 text-ash-deep">
                Send us this plan and we&apos;ll contact each venue on your behalf. There&apos;s nothing to pay now.
              </p>
              <EnquiryForm plan={plan} />
            </div>
          ) : (
            <div className="border border-line p-6 sm:p-9">
              <h2 className="text-2xl font-light">We couldn&apos;t fill this night yet</h2>
              <p className="mt-3 text-ash">Our list is still growing. A wider area or budget usually finds something.</p>
              <Link href={`/plan?edit=${id}`} className={`${button.light} mt-6`}>
                Change answers
              </Link>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
