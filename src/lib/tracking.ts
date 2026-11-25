import type { BookingPlatform } from "@/lib/booking/platforms";
import type { Stop } from "@/lib/plan/answers";

// A tap from PlanMyNights out to a venue: its booking page, website or Google Maps.
// Logged in outbound_clicks so the Control Center can show where we send traffic.
export type OutboundClick = {
  venueSlug: string;
  kind: "book" | "website" | "maps";
  platform?: BookingPlatform;
  source: "plan" | "plan_time" | "venue";
  stop?: Stop;
  nightDate?: string;
  partySize?: number;
  planKey?: string;
};
