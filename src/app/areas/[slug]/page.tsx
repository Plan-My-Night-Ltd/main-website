import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AreaTile } from "@/components/area-tile";
import { PhotoHero } from "@/components/photo-hero";
import { button } from "@/components/ui";
import { regionLabel } from "@/lib/data/areas";
import { priceBandLabel } from "@/lib/format";
import { photo } from "@/lib/photos";
import type { VenueType } from "@/lib/types";
import { getArea, listAreas, venuesInArea } from "@/lib/venues";

export const dynamicParams = false;
export const revalidate = 3600;

export function generateStaticParams() {
  return listAreas().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata(props: PageProps<"/areas/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const area = getArea(slug);
  if (!area) return {};
  const title = `Best nights out in ${area.name}`;
  const description =
    area.blurb ?? `Restaurants, bars and clubs in ${area.name}, London, with dress codes, door policies and closing times.`;
  const p = photo(slug);
  return {
    title,
    description,
    openGraph: { title, description, type: "website", images: p ? [{ url: p.src }] : undefined },
  };
}

const sections: { type: VenueType; heading: string }[] = [
  { type: "restaurant", heading: "Dinner" },
  { type: "bar", heading: "Drinks" },
  { type: "club", heading: "Dancing" },
];

export default async function AreaPage(props: PageProps<"/areas/[slug]">) {
  const { slug } = await props.params;
  const area = getArea(slug);
  if (!area) notFound();
  const venues = await venuesInArea(slug);
  const nearby = listAreas()
    .filter((a) => a.region === area.region && a.slug !== area.slug)
    .slice(0, 4);

  return (
    <>
      <PhotoHero photo={photo(slug)}>
        <nav aria-label="Breadcrumb" className="text-sm text-white/70">
          <Link href="/areas" className="hover:text-white">
            {regionLabel[area.region]} London
          </Link>
        </nav>
        <h1 className="mt-3 max-w-4xl text-display font-light">Best nights out in {area.name}</h1>
      </PhotoHero>

      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="grid gap-10 py-16 sm:py-20 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          {area.blurb && <p className="max-w-2xl text-xl font-light leading-relaxed text-white/85">{area.blurb}</p>}
          <div className="lg:justify-self-end">
            <Link href={`/plan?area=${area.slug}`} className={button.light}>
              Plan a night in {area.name}
            </Link>
          </div>
        </div>

        {venues.length === 0 ? (
          <p className="max-w-lg border-t border-line pt-10 text-ash">
            We haven&apos;t added places in {area.name} yet. Plan a night here anyway and we&apos;ll suggest the closest
            places we have.
          </p>
        ) : (
          <div className="grid gap-14 border-t border-line pt-12 lg:grid-cols-3 lg:gap-12">
            {sections.map(({ type, heading }) => {
              const list = venues.filter((v) => v.type === type);
              if (list.length === 0) return null;
              return (
                <section key={type} aria-labelledby={`h-${type}`}>
                  <h2 id={`h-${type}`} className="text-sm text-ash">
                    {heading}
                  </h2>
                  <ul className="mt-2 divide-y divide-line">
                    {list.map((v) => (
                      <li key={v.slug}>
                        <Link href={`/venues/${v.slug}`} className="group block py-6">
                          <span className="flex items-baseline justify-between gap-4">
                            <span className="text-2xl font-light underline-offset-[6px] group-hover:underline">
                              {v.name}
                            </span>
                            {v.priceBand && <span className="text-sm text-ash">{priceBandLabel(v.priceBand)}</span>}
                          </span>
                          <span className="mt-2 block text-[0.9375rem] text-white/70">{v.description}</span>
                          {v.nearestTube && <span className="mt-2 block text-sm text-ash">Near {v.nearestTube}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}

        {nearby.length > 0 && (
          <section className="mt-24" aria-labelledby="nearby">
            <h2 id="nearby" className="text-title font-light">
              Also in {regionLabel[area.region]} London
            </h2>
            <ul className="mt-10 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {nearby.map((a) => (
                <li key={a.slug}>
                  <AreaTile area={a} sizes="(min-width: 1024px) 25vw, 50vw" />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
