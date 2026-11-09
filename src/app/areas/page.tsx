import type { Metadata } from "next";
import { AreaTile } from "@/components/area-tile";
import { regionLabel } from "@/lib/data/areas";
import { listAreas, venueCountsByArea } from "@/lib/venues";

export const metadata: Metadata = {
  title: "London neighbourhoods for a night out",
  description: "Where to eat, drink and dance across London, neighbourhood by neighbourhood.",
};

export const revalidate = 3600;

export default async function AreasPage() {
  const areas = listAreas();
  const counts = await venueCountsByArea();
  return (
    <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-8 sm:pt-24">
      <h1 className="max-w-3xl text-display font-light">London, neighbourhood by neighbourhood</h1>
      {(Object.keys(regionLabel) as (keyof typeof regionLabel)[]).map((region) => (
        <section key={region} aria-labelledby={`r-${region}`} className="mt-20">
          <h2 id={`r-${region}`} className="border-b border-line pb-4 text-xl font-light">
            {regionLabel[region]}
          </h2>
          <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {areas
              .filter((a) => a.region === region)
              .map((a) => {
                const count = counts.get(a.slug) ?? 0;
                return (
                  <li key={a.slug}>
                    <AreaTile
                      area={a}
                      note={count > 0 ? `${count} places` : undefined}
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                    />
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
