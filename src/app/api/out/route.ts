import { isBookingPlatform } from "@/lib/booking/platforms";
import { serverSupabase } from "@/lib/supabase/server";

// Logs a tap out to a venue (see components/outbound-link.tsx). Sent with
// navigator.sendBeacon, so nobody waits on it and the answer is always empty.
// Signed-in people are logged as themselves; row level security stops anyone
// logging a click as someone else.

const kinds = ["book", "website", "maps"];
const sources = ["plan", "plan_time", "venue"];
const stops = ["dinner", "drinks", "club"];

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const venueSlug = typeof body.venueSlug === "string" ? body.venueSlug.slice(0, 200) : "";
  const kind = typeof body.kind === "string" && kinds.includes(body.kind) ? body.kind : null;
  const source = typeof body.source === "string" && sources.includes(body.source) ? body.source : null;
  if (!venueSlug || !kind || !source) return new Response(null, { status: 400 });

  const supabase = await serverSupabase();
  if (!supabase) return new Response(null, { status: 204 });

  const nightDate = typeof body.nightDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.nightDate) ? body.nightDate : null;
  const partySize = Number(body.partySize);
  const { data } = await supabase.auth.getUser();

  // A slug that isn't a venue fails the foreign key and is simply not logged.
  await supabase.from("outbound_clicks").insert({
    user_id: data.user?.id ?? null,
    venue_slug: venueSlug,
    kind,
    platform: isBookingPlatform(body.platform) ? body.platform : null,
    source,
    stop: typeof body.stop === "string" && stops.includes(body.stop) ? body.stop : null,
    night_date: nightDate,
    party_size: Number.isInteger(partySize) && partySize >= 1 && partySize <= 50 ? partySize : null,
    plan_key: typeof body.planKey === "string" ? body.planKey.slice(0, 2000) : null,
  });

  return new Response(null, { status: 204 });
}
