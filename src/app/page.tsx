import Image from "next/image";
import Link from "next/link";
import { AreaCarousel } from "@/components/area-carousel";
import { AreaTile } from "@/components/area-tile";
import { NightLine } from "@/components/night-line";
import { button } from "@/components/ui";
import { VenueFacts } from "@/components/venue-facts";
import { launchAreaSlugs, regionLabel } from "@/lib/data/areas";
import { buildPlan } from "@/lib/plan/build";
import { photo } from "@/lib/photos";
import { getArea, getVenue, listAreas, listVenues, venuesInArea } from "@/lib/venues";

const SATURDAY = 5;

export default function Home() {
  // A real plan from the engine, so the example always matches what guests get.
  const example = buildPlan(
    {
      date: "2026-11-07",
      start: "19:30",
      stops: ["dinner", "drinks", "club"],
      group: "friends",
      partySize: 4,
      area: "soho",
      budget: 2,
      vibes: ["buzzy"],
      music: "house-techno",
    },
    listVenues(),
    listAreas(),
  );
  const factsVenue = getVenue("basement-forty");
  const hero = photo("hero-street");
  const allAreas = listAreas();
  const orderedAreas = [
    ...launchAreaSlugs.map((slug) => getArea(slug)!),
    ...allAreas.filter((a) => !launchAreaSlugs.includes(a.slug)),
  ];

  return (
    <>
      <section className="relative isolate flex h-[min(calc(100svh-4.25rem),56rem)] min-h-[34rem] items-end overflow-hidden">
        {hero && (
          <Image src={hero.src} alt="" fill priority sizes="100vw" className="photo -z-10 object-cover" />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/55 to-black/25" />
        <div className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-8 sm:pb-24">
          <h1 className="max-w-4xl text-display font-light">Your London night, planned in a minute.</h1>
          <p className="mt-6 max-w-xl text-lg font-light text-white/80">
            Dinner, drinks and somewhere to dance, chosen for you and arranged in order, each a short walk from the
            last.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/plan" className={button.light}>
              Plan my night
            </Link>
            <Link href="#neighbourhoods" className={button.ghost}>
              Browse neighbourhoods
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-bone text-black">
        <div className="mx-auto grid max-w-7xl gap-14 px-4 py-24 sm:px-8 sm:py-32 lg:grid-cols-2 lg:gap-24">
          <div className="max-w-lg">
            <h2 className="text-title font-light">An evening, arranged.</h2>
            <p className="mt-6 text-ash-deep">
              Answer seven short questions about the night you have in mind. We choose a table for dinner, a bar for
              afterwards and somewhere to dance if you want it, all open when you&apos;ll arrive and close enough to
              walk between.
            </p>
            <p className="mt-4 text-ash-deep">
              Share the plan with your group, or send it to us and we&apos;ll make the bookings.
            </p>
            <Link href="/plan" className={`${button.dark} mt-10`}>
              Plan my night
            </Link>
          </div>
          <figure>
            <figcaption className="mb-8 text-sm text-ash-deep">A Saturday in Soho for four friends</figcaption>
            <NightLine stops={example.stops} tone="onLight" size="compact" />
          </figure>
        </div>
      </section>

      <section id="neighbourhoods" className="scroll-mt-4 py-24 sm:py-32">
        <AreaCarousel
          heading={<h2 className="text-title font-light">Neighbourhoods</h2>}
          intro={
            <p className="mt-4 text-ash">
              Thirty corners of London, from Mayfair hotel bars to Dalston basements. Start with one, or let us choose.
            </p>
          }
          footer={
            <Link href="/areas" className="text-sm text-white/75 underline underline-offset-8 hover:text-white">
              See all {allAreas.length} neighbourhoods
            </Link>
          }
        >
          {orderedAreas.map((area) => {
            const count = venuesInArea(area.slug).length;
            return (
              <li key={area.slug} className="w-[68vw] shrink-0 snap-start sm:w-[38vw] lg:w-[23vw] xl:w-[18.5rem]">
                <AreaTile
                  area={area}
                  note={count > 0 ? `${count} places` : regionLabel[area.region]}
                  sizes="(min-width: 1280px) 296px, (min-width: 1024px) 23vw, (min-width: 640px) 38vw, 68vw"
                />
              </li>
            );
          })}
        </AreaCarousel>
      </section>

      {factsVenue && (
        <section className="bg-white text-black">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-8 sm:py-32 lg:grid-cols-2 lg:gap-24">
            <div className="max-w-md">
              <h2 className="text-title font-light">Know the door before you arrive.</h2>
              <p className="mt-6 text-ash-deep">
                Every venue lists what a visitor needs: which station to use, what to wear, whether you&apos;ll get in,
                what it costs and when it closes.
              </p>
            </div>
            <div>
              <p className="mb-4 flex items-baseline gap-3">
                <Link href={`/venues/${factsVenue.slug}`} className="text-2xl font-light hover:underline">
                  {factsVenue.name}
                </Link>
                <span className="text-sm text-ash-deep">{getArea(factsVenue.areaSlug)?.name}</span>
              </p>
              <VenueFacts venue={factsVenue} weekday={SATURDAY} tone="onLight" />
            </div>
          </div>
        </section>
      )}
    </>
  );
}
