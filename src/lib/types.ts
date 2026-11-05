// App-side shapes. These mirror the Supabase tables in
// supabase/migrations/20261102000000_initial_schema.sql (camelCased).

export type VenueType = "restaurant" | "bar" | "club";
export type Region = "central" | "east" | "west" | "south" | "north";

export type Area = {
  slug: string;
  name: string;
  region: Region;
  lat: number;
  lng: number;
  blurb?: string;
};

export type OpeningPeriod = {
  weekday: number; // 0 = Monday
  opens: string; // "HH:MM"
  closes: string; // "HH:MM"; earlier than opens means after midnight
};

export type Venue = {
  slug: string;
  name: string;
  type: VenueType;
  areaSlug: string;
  address: string;
  lat: number;
  lng: number;
  nearestTube: string;
  priceBand: 1 | 2 | 3 | 4;
  pricePerHeadGbp: number;
  vibeTags: string[];
  musicTags: string[];
  cuisine?: string;
  dressCode: string;
  doorPolicy: string;
  bookingUrl?: string;
  description: string;
  source: "curated" | "foursquare";
  hours: OpeningPeriod[];
};
