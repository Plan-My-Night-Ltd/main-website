import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { call, type Traffic } from "@/app/control-center/data";
import { label, num, pct } from "@/components/control-center/labels";
import { BarList, Panel, SetupNotice, Stat, StatGrid, Table, Td } from "@/components/control-center/ui";

// Where we send people: every tap on Book, a table time, a venue's website or
// Google Maps, next to how many of those venues were then marked as booked.
export async function TrafficTab({ supabase, since, rangeLabel }: { supabase: SupabaseClient; since: string | null; rangeLabel: string }) {
  const res = await call<Traffic>(supabase, "admin_traffic", { p_since: since });
  if (res.error !== null) return <SetupNotice error={res.error} />;
  const t = res.data;

  const bookingSiteClicks = t.destinations.filter((d) => d.key !== "website" && d.key !== "maps").reduce((s, d) => s + d.clicks, 0);

  return (
    <div className="space-y-6">
      <StatGrid>
        <Stat label="Clicks to venues" value={num(t.clicks)} note={rangeLabel === "All time" ? "all time" : `last ${rangeLabel.toLowerCase()}`} />
        <Stat label="To booking sites" value={num(bookingSiteClicks)} note={`${pct(bookingSiteClicks, t.clicks)} of clicks`} />
        <Stat label="Venues clicked" value={num(t.venues.filter((v) => v.clicks > 0).length)} note={t.venues.length >= 100 ? "top 100 shown below" : undefined} />
        <Stat label="Marked as booked" value={num(t.bookings)} note={`${pct(t.bookings, t.clicks)} of clicks`} />
      </StatGrid>

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Panel
          title="By booking site"
          note="Clicks are taps from PlanMyNights. Booked is where the venue's Book button would have sent them."
        >
          <Table head={["Sent to", "Clicks", "Share", "People", "Booked"]} empty={t.destinations.length === 0 && "No clicks yet."}>
            {t.destinations.map((d) => (
              <tr key={d.key}>
                <Td className="text-white">{label.destination(d.key)}</Td>
                <Td num>{num(d.clicks)}</Td>
                <Td num className="text-ash">
                  {pct(d.clicks, t.clicks)}
                </Td>
                <Td num>{num(d.people)}</Td>
                <Td num>{num(d.bookings)}</Td>
              </tr>
            ))}
          </Table>
        </Panel>

        <div className="grid gap-3">
          <Panel title="Where the click happened">
            <BarList rows={t.sources.map((s) => ({ key: s.key, label: label.source(s.key), n: s.n }))} empty="No clicks yet." />
          </Panel>
          <Panel title="Which stop of the night">
            <BarList
              rows={t.stops.map((s) => ({ key: s.key, label: s.key === "none" ? "Venue page (no plan)" : label.stop(s.key), n: s.clicks }))}
              empty="No clicks yet."
            />
          </Panel>
        </div>
      </div>

      <Panel title="By venue" note="Most clicked first, then most booked. People counts signed-in people only.">
        <Table
          head={["Venue", "Type", "Area", "Books through", "Clicks", "To booking page", "People", "Booked", "Covers", "Booked per click"]}
          empty={t.venues.length === 0 && "No clicks or bookings yet."}
        >
          {t.venues.map((v) => (
            <tr key={v.slug} className="hover:bg-white/[0.03]">
              <Td>
                <Link href={`/venues/${v.slug}`} className="text-white hover:underline hover:underline-offset-4">
                  {v.name}
                </Link>
              </Td>
              <Td className="text-white/75">{label.venueType(v.type)}</Td>
              <Td className="text-white/75">{label.area(v.area)}</Td>
              <Td className="text-white/75">{v.platform ? label.platform(v.platform) : ""}</Td>
              <Td num>{num(v.clicks)}</Td>
              <Td num>{num(v.book_clicks)}</Td>
              <Td num>{num(v.people)}</Td>
              <Td num>{num(v.bookings)}</Td>
              <Td num>{num(v.covers)}</Td>
              <Td num className="text-ash">
                {pct(v.bookings, v.clicks)}
              </Td>
            </tr>
          ))}
        </Table>
      </Panel>

      <Panel title="By area">
        <Table head={["Area", "Clicks", "Booked"]} empty={t.areas.length === 0 && "No clicks or bookings yet."}>
          {t.areas.map((a) => (
            <tr key={a.key}>
              <Td className="text-white">{label.area(a.key)}</Td>
              <Td num>{num(a.clicks)}</Td>
              <Td num>{num(a.bookings)}</Td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
