import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { call, type Bookings } from "@/app/control-center/data";
import { day, dayTime, label, num, pct } from "@/components/control-center/labels";
import { londonToday } from "@/lib/format";
import { BarList, Panel, SetupNotice, Stat, StatGrid, Table, Td, Tick } from "@/components/control-center/ui";

// Every "Mark as booked", with what the person asked for that night.
export async function BookingsTab({ supabase, since, rangeLabel }: { supabase: SupabaseClient; since: string | null; rangeLabel: string }) {
  const res = await call<Bookings>(supabase, "admin_bookings", { p_since: since });
  if (res.error !== null) return <SetupNotice error={res.error} />;
  const b = res.data;
  const today = londonToday();

  return (
    <div className="space-y-6">
      <StatGrid>
        <Stat label="Marked as booked" value={num(b.total)} note={rangeLabel === "All time" ? "all time" : `last ${rangeLabel.toLowerCase()}`} />
        <Stat label="Covers" value={num(b.covers)} note="people across those bookings" />
        <Stat label="People who booked" value={num(b.people)} />
        <Stat
          label="Booked after clicking through"
          value={pct(b.after_click, b.total)}
          note={`${num(b.after_click)} tapped that venue's link on PlanMyNights first`}
        />
      </StatGrid>

      <div className="grid gap-3 md:grid-cols-2">
        <Panel title="Which stop">
          <BarList rows={b.by_stop.map((s) => ({ key: s.key, label: label.stop(s.key), n: s.n }))} empty="No bookings yet." />
        </Panel>
        <Panel title="Type of venue">
          <BarList rows={b.by_type.map((s) => ({ key: s.key, label: label.venueType(s.key), n: s.n }))} empty="No bookings yet." />
        </Panel>
      </div>

      <Panel
        title="All bookings"
        note={`Newest first. ${num(b.upcoming)} are for tonight or later. "Their night" is what they asked the planner for.`}
        action={
          <a href="/control-center/export?type=bookings" className="text-sm text-white/85 underline underline-offset-4 hover:text-white">
            Download all (CSV)
          </a>
        }
      >
        <Table
          head={["Marked", "Night", "Person", "Venue", "Stop", "Party", "Books through", "Clicked first", "Their night"]}
          empty={b.list.length === 0 ? "Nobody has marked a venue as booked yet." : b.list.length >= 500 ? "Showing the latest 500." : false}
        >
          {b.list.map((r) => (
            <tr key={`${r.user_id}-${r.venue_slug}-${r.night_date}`} className="hover:bg-white/[0.03]">
              <Td className="text-white/75">{dayTime(r.created_at)}</Td>
              <Td>
                {day(r.night_date)}
                {r.night_date >= today && <span className="ml-2 text-xs text-ash">upcoming</span>}
              </Td>
              <Td>
                <Link href={`/control-center/people/${r.user_id}`} className="text-white hover:underline hover:underline-offset-4">
                  {r.name || r.email}
                </Link>
              </Td>
              <Td>
                <Link href={`/venues/${r.venue_slug}`} className="text-white hover:underline hover:underline-offset-4">
                  {r.venue ?? r.venue_slug}
                </Link>
                <span className="block text-ash">
                  {[label.venueType(r.venue_type), label.area(r.area)].filter(Boolean).join(", ")}
                </span>
              </Td>
              <Td>{label.stop(r.stop)}</Td>
              <Td num>{r.party_size ?? ""}</Td>
              <Td className="text-white/75">{r.platform ? label.platform(r.platform) : ""}</Td>
              <Td>
                <Tick on={r.after_click} no="No" />
              </Td>
              <Td className="text-white/75">
                {r.answers
                  ? [
                      label.group(r.answers.group),
                      label.budgetShort(r.answers.budget),
                      label.area(r.answers.area),
                      r.answers.vibes?.length ? r.answers.vibes.map(label.vibe).join(", ").toLowerCase() : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : ""}
              </Td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
