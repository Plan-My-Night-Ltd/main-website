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

// Imported venues only have what Foursquare knows; the optional fields marked
// "checked" are filled in when a venue is checked by hand (`verified`).
export type Venue = {
  slug: string;
  name: string;
  type: VenueType;
  areaSlug: string;
  address: string;
  lat: number;
  lng: number;
  nearestTube?: string;
  priceBand?: 1 | 2 | 3 | 4;
  pricePerHeadGbp?: number; // checked
  vibeTags: string[]; // hand-set and inferred tags together
  musicTags: string[];
  cuisine?: string;
  dressCode?: string; // checked
  doorPolicy?: string; // checked
  bookingUrl?: string;
  description: string;
  rating?: number; // Foursquare, 0 to 10
  verified: boolean;
  source: "curated" | "foursquare";
  hours: OpeningPeriod[];
};
