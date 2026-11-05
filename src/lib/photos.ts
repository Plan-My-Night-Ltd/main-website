import { photoCredits, type PhotoCredit } from "@/lib/data/photo-credits";

export type Photo = { src: string; credit: PhotoCredit };

/** Neighbourhood photo from public/images, keyed by area slug (or "hero-street"). */
export function photo(key: string): Photo | undefined {
  const credit = photoCredits[key];
  return credit ? { src: `/images/${key}.jpg`, credit } : undefined;
}
