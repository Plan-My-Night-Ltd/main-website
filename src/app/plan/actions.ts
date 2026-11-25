"use server";

import { revalidatePath } from "next/cache";
import type { Stop } from "@/lib/plan/answers";
import { serverSupabase } from "@/lib/supabase/server";

export type BookingInput = { venueSlug: string; nightDate: string; stop: Stop; partySize: number; planKey: string };

const stops: Stop[] = ["dinner", "drinks", "club"];

/** Marks (or unmarks) a venue as booked for a night. Returns whether it worked. */
export async function setBooked(input: BookingInput, booked: boolean): Promise<boolean> {
  const supabase = await serverSupabase();
  if (!supabase) return false;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.nightDate) || !input.venueSlug || !stops.includes(input.stop)) return false;

  // Row level security limits both of these to the signed-in person's own bookings.
  const { error } = booked
    ? await supabase.from("bookings").upsert(
        {
          user_id: data.user.id,
          venue_slug: input.venueSlug,
          night_date: input.nightDate,
          stop: input.stop,
          party_size: Math.min(Math.max(Math.round(input.partySize) || 1, 1), 50),
          plan_key: input.planKey,
        },
        { onConflict: "user_id,venue_slug,night_date" },
      )
    : await supabase.from("bookings").delete().eq("venue_slug", input.venueSlug).eq("night_date", input.nightDate);

  revalidatePath("/account");
  return !error;
}
