import Link from "next/link";
import { regionLabel } from "@/lib/data/areas";
import { listAreas, usingSampleData } from "@/lib/venues";

export function SiteFooter() {
  const areas = listAreas();
  return (
    <footer className="border-t border-line bg-black">
      <div className="mx-auto max-w-7xl px-4 pt-16 pb-10 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_3fr]">
          <div>
            <p className="text-[0.9375rem] tracking-[0.34em]">PLANMYNIGHTS</p>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ash">
              An evening in London, arranged for you. Dinner, drinks and somewhere to dance, in the right order.
            </p>
          </div>
          <nav aria-label="Neighbourhoods" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
            {(Object.keys(regionLabel) as (keyof typeof regionLabel)[]).map((region) => (
              <div key={region}>
                <p className="text-sm text-white">{regionLabel[region]}</p>
                <ul className="mt-3 space-y-2 text-sm text-ash">
                  {areas
                    .filter((a) => a.region === region)
                    .map((a) => (
                      <li key={a.slug}>
                        <Link href={`/areas/${a.slug}`} className="hover:text-white">
                          {a.name}
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-line pt-6 text-xs text-ash sm:flex-row sm:items-center sm:justify-between">
          <p>
            {usingSampleData
              ? "Preview build. Venues shown are sample data, not real recommendations."
              : `© ${new Date().getFullYear()} PlanMyNights`}
          </p>
          <Link href="/credits" className="hover:text-white">
            Photo credits
          </Link>
        </div>
      </div>
    </footer>
  );
}
