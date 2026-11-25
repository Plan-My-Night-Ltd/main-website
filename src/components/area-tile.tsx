import Image from "next/image";
import Link from "next/link";
import { photo } from "@/lib/photos";
import type { Area } from "@/lib/types";

// A neighbourhood as a photograph with its name set over the bottom edge. Links to
// the neighbourhood's page unless `href` says otherwise.
export function AreaTile({ area, note, sizes, href }: { area: Area; note?: string; sizes: string; href?: string }) {
  const p = photo(area.slug);
  return (
    <Link href={href ?? `/areas/${area.slug}`} className="group relative block aspect-[4/5] overflow-hidden bg-raised">
      {p && (
        <Image
          src={p.src}
          alt=""
          fill
          sizes={sizes}
          className="photo object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
      <span className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
        <span className="block text-xl font-light sm:text-2xl">{area.name}</span>
        {note && <span className="mt-0.5 block text-sm text-white/65">{note}</span>}
      </span>
    </Link>
  );
}
