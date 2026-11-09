import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PhotoHero } from "@/components/photo-hero";
import { button } from "@/components/ui";
import { VenueFacts } from "@/components/venue-facts";
import { VisitedToggle } from "@/components/visited-toggle";
import { hoursLine, venueTypeLabel, weekdayNames } from "@/lib/format";
import { photo } from "@/lib/photos";
import { getArea, getVenue, usingSampleData, venuesInArea } from "@/lib/venues";

// There are thousands of venues, so each page is built on its first visit and
// then cached, rather than all at build time.
export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata(props: PageProps<"/venues/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const venue = await getVenue(slug);
  if (!venue) return {};
  const area = getArea(venue.areaSlug);
  const title = `${venue.name}, ${area?.name}`;
  const description = [
    venue.description,
    venue.nearestTube && `Nearest Tube: ${venue.nearestTube}.`,
    venue.dressCode && `Dress code: ${venue.dressCode}.`,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    title,
    description,
    openGraph: { title, description: venue.description, type: "website" },
  };
}

export default async function VenuePage(props: PageProps<"/venues/[slug]">) {
  const { slug } = await props.params;
  const venue = await getVenue(slug);
  if (!venue) notFound();
  const area = getArea(venue.areaSlug)!;
  const nearby = (await venuesInArea(area.slug, 4)).filter((v) => v.slug !== venue.slug);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`;

  return (
    <article>
      {/* Until venues have their own photography, the header shows the neighbourhood. */}
      <PhotoHero photo={photo(area.slug)} height="short">
        <nav aria-label="Breadcrumb" className="text-sm text-white/70">
          <Link href={`/areas/${area.slug}`} className="hover:text-white">
            {area.name}
          </Link>
        </nav>
        <h1 className="mt-3 text-display font-light">{venue.name}</h1>
        <p className="mt-3 text-white/75">
          {venueTypeLabel[venue.type]}
          {venue.cuisine && `, ${venue.cuisine.toLowerCase()}`}
        </p>
      </PhotoHero>

      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <p className="max-w-3xl py-16 text-xl font-light leading-relaxed text-white/85 sm:py-20 sm:text-2xl">
          {venue.description}
        </p>

        <div className="grid gap-16 lg:grid-cols-[1.2fr_1fr] lg:gap-24">
          <section aria-labelledby="before-you-go">
            <h2 id="before-you-go" className="mb-4 text-sm text-ash">
              Before you go
            </h2>
            <VenueFacts venue={venue} />
            <div className="mt-10 flex flex-wrap gap-3">
              {venue.bookingUrl && (
                <a href={venue.bookingUrl} target="_blank" rel="noopener noreferrer" className={button.light}>
                  {venue.type === "club" ? "Get tickets" : "Book a table"}
                </a>
              )}
              <Link href={`/plan?area=${area.slug}`} className={button.ghost}>
                Plan a night in {area.name}
              </Link>
            </div>
            <div className="mt-6">
              <VisitedToggle venueSlug={venue.slug} />
            </div>
          </section>

          <section aria-labelledby="hours">
            <h2 id="hours" className="mb-4 text-sm text-ash">
              Opening hours
            </h2>
            {venue.hours.length === 0 ? (
              <p className="text-ash">Opening hours aren&apos;t listed yet.</p>
            ) : (
              <table className="w-full text-[0.9375rem]">
                <tbody className="divide-y divide-line border-y border-line">
                  {weekdayNames.map((day, i) => {
                    const line = hoursLine(venue.hours, i);
                    return (
                      <tr key={day}>
                        <th scope="row" className="py-3 text-left font-normal text-ash">
                          {day}
                        </th>
                        <td className={`py-3 text-right ${line === "Closed" ? "text-ash" : ""}`}>{line}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            <h2 className="mt-12 mb-2 text-sm text-ash">Address</h2>
            <address className="not-italic">{venue.address}</address>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-white/75 underline underline-offset-4 hover:text-white"
            >
              Open in Google Maps
            </a>

            {usingSampleData ? (
              <p className="mt-12 text-sm text-ash">This is a sample venue used to preview the site.</p>
            ) : (
              !venue.verified && (
                <p className="mt-12 text-sm text-ash">
                  Details from Foursquare. We haven&apos;t checked this venue ourselves yet, so confirm hours and entry
                  before you go.
                </p>
              )
            )}
          </section>
        </div>

        {nearby.length > 0 && (
          <section className="mt-24 border-t border-line pt-12" aria-labelledby="nearby">
            <h2 id="nearby" className="text-title font-light">
              More in {area.name}
            </h2>
            <ul className="mt-8 grid gap-x-12 sm:grid-cols-2">
              {nearby.map((v) => (
                <li key={v.slug} className="border-b border-line">
                  <Link href={`/venues/${v.slug}`} className="group flex items-baseline justify-between gap-4 py-5">
                    <span className="text-xl font-light underline-offset-[6px] group-hover:underline">{v.name}</span>
                    <span className="text-sm text-ash">{venueTypeLabel[v.type]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </article>
  );
}
