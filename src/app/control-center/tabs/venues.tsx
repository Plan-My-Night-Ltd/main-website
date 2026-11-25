import type { SupabaseClient } from "@supabase/supabase-js";
import { call, type Catalogue } from "@/app/control-center/data";
import { day, label, num, pct } from "@/components/control-center/labels";
import { BarList, Panel, SetupNotice, Stat, StatGrid, Table, Td } from "@/components/control-center/ui";

// How complete the venue list is: what's live, checked by hand, and bookable from the site.
export async function VenuesTab({ supabase }: { supabase: SupabaseClient }) {
  const res = await call<Catalogue>(supabase, "admin_catalogue");
  if (res.error !== null) return <SetupNotice error={res.error} />;
  const c = res.data;

  return (
    <div className="space-y-6">
      <StatGrid>
        <Stat label="Live venues" value={num(c.published)} note={`${num(c.total)} in the database`} />
        <Stat label="Checked by hand" value={num(c.verified)} note={`${pct(c.verified, c.published)} of live venues`} />
        <Stat label="With a booking link" value={num(c.with_booking_url)} note={`${pct(c.with_booking_url, c.published)} can be booked from the site`} />
        <Stat label="Opening hours known" value={num(c.with_hours)} note={`${pct(c.with_hours, c.published)}; venues without hours never appear in plans`} />
        <Stat label="With a website" value={num(c.with_website)} />
        <Stat label="Walk-ins only" value={num(c.walk_ins_only)} note="from Google Maps" />
        <Stat label="Booking details checked" value={num(c.enriched)} note="via Google Maps" />
        <Stat label="Last import" value={<span className="text-2xl">{day(c.last_import) || "Never"}</span>} note="Foursquare refresh" />
      </StatGrid>

      <div className="grid gap-3 md:grid-cols-2">
        <Panel title="How live venues take bookings">
          <BarList rows={c.by_platform.map((p) => ({ key: p.key, label: label.platform(p.key), n: p.n }))} />
        </Panel>
        <Panel title="Type of venue">
          <BarList
            rows={Object.entries(c.by_type)
              .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
              .map(([k, n]) => ({ key: k, label: label.venueType(k), n: n ?? 0 }))}
          />
        </Panel>
      </div>

      <Panel title="By area" note="Live venues in each neighbourhood, and how many we've checked ourselves.">
        <Table head={["Area", "Live venues", "Checked", "Share checked"]}>
          {c.by_area.map((a) => (
            <tr key={a.key}>
              <Td className="text-white">{label.area(a.key)}</Td>
              <Td num>{num(a.n)}</Td>
              <Td num>{num(a.verified)}</Td>
              <Td num className="text-ash">
                {pct(a.verified, a.n)}
              </Td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
