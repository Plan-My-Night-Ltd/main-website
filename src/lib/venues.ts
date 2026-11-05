import { areas } from "@/lib/data/areas";
import { sampleVenues } from "@/lib/data/sample-venues";
import type { Area, Venue } from "@/lib/types";

// Data access for pages. Reads local sample data until Supabase is connected;
// swap these bodies for Supabase queries and the pages stay the same.

export const usingSampleData = true;

export function listAreas(): Area[] {
  return areas;
}

export function getArea(slug: string): Area | undefined {
  return areas.find((a) => a.slug === slug);
}

export function listVenues(): Venue[] {
  return sampleVenues;
}

export function getVenue(slug: string): Venue | undefined {
  return sampleVenues.find((v) => v.slug === slug);
}

export function venuesInArea(areaSlug: string): Venue[] {
  return sampleVenues.filter((v) => v.areaSlug === areaSlug);
}
