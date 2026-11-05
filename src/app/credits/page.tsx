import type { Metadata } from "next";
import { photoCredits } from "@/lib/data/photo-credits";
import { getArea } from "@/lib/venues";

export const metadata: Metadata = {
  title: "Photo credits",
  robots: { index: false },
};

export default function CreditsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-16 sm:px-8 sm:pt-24">
      <h1 className="text-title font-light">Photo credits</h1>
      <p className="mt-4 text-ash">
        Neighbourhood photographs come from Wikimedia Commons and are shown in black and white. Thank you to the
        photographers below.
      </p>
      <ul className="mt-10 divide-y divide-line border-y border-line text-[0.9375rem]">
        {Object.entries(photoCredits).map(([key, c]) => (
          <li key={key} className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr]">
            <span>{getArea(key)?.name ?? "Regent Street at night"}</span>
            <a href={c.source} target="_blank" rel="noopener noreferrer" className="text-ash hover:text-white">
              {c.artist}, {c.license}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
