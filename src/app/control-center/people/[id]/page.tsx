import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { call, requireAdmin, type AdminUserDetail } from "@/app/control-center/data";
import { ccHref } from "@/app/control-center/href";
import { day, dayTime, label, num } from "@/components/control-center/labels";
import { Panel, SetupNotice, Stat, StatGrid, Table, Td } from "@/components/control-center/ui";
import { friendlyTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "Person · Control Center",
  robots: { index: false, follow: false },
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One person in full: every search with what they chose, where they clicked, what they booked.
export default async function PersonPage(props: PageProps<"/control-center/people/[id]">) {
  const { id } = await props.params;
  const supabase = await requireAdmin(`/control-center/people/${id}`);
  if (!uuid.test(id)) notFound();

  const { data: u, error } = await call<AdminUserDetail | null>(supabase, "admin_user", { p_id: id });
  if (error)
    return (
      <div className="mx-auto max-w-7xl px-4 pt-10 pb-24 sm:px-8">
        <SetupNotice error={error} />
      </div>
    );
  if (!u) notFound();

  const nights = new Set(u.searches.map((s) => s.night_date)).size;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 pb-24 sm:px-8 sm:pt-14">
      <Link href={ccHref({ tab: "people" })} className="text-sm text-ash hover:text-white">
        ← Everyone
      </Link>
      <h1 className="mt-3 text-title font-light">{u.name || u.email}</h1>
      <p className="mt-2 text-ash">
        {u.name && <>{u.email} · </>}
        Signed up {day(u.signed_up_at)} with {label.provider(u.provider)}
        {!u.confirmed && " (email not confirmed)"} · Last signed in {u.last_sign_in_at ? dayTime(u.last_sign_in_at) : "never"} · Emails:{" "}
        {u.marketing_opt_in === true ? `yes, since ${day(u.marketing_opt_in_at)}` : u.marketing_opt_in === false ? "no" : "not asked yet"}
      </p>

      <div className="mt-8">
        <StatGrid>
          <Stat label="Searches" value={num(u.searches.length)} />
          <Stat label="Nights planned" value={num(nights)} note="different dates" />
          <Stat label="Days active" value={num(u.days_active)} note={u.days_active > 1 ? "returning" : "one visit so far"} />
          <Stat label="Clicks to venues" value={num(u.clicks.length)} />
          <Stat label="Marked as booked" value={num(u.bookings.length)} />
          <Stat label="Places they've been" value={num(u.visits.length)} note="ticked on venue pages" />
        </StatGrid>
      </div>

      <div className="mt-8 space-y-6">
        <Panel title="Searches" note="What they chose each time, newest first. Open plan shows the night we gave them.">
          <Table
            head={["Searched", "Night", "Where", "Shape", "Who", "Party", "Budget", "Vibes", "Music", "Start", ""]}
            empty={u.searches.length === 0 && "No searches yet."}
          >
            {u.searches.map((s) => {
              const a = s.answers;
              return (
                <tr key={`${s.plan_key}-${s.created_at}`}>
                  <Td className="text-white/75">{dayTime(s.created_at)}</Td>
                  <Td>{day(s.night_date)}</Td>
                  <Td>{label.area(a.area)}</Td>
                  <Td>{label.shape((a.stops ?? []).join(","))}</Td>
                  <Td>{label.group(a.group)}</Td>
                  <Td num>{a.partySize}</Td>
                  <Td>{label.budgetShort(a.budget)}</Td>
                  <Td className="text-white/75">{(a.vibes ?? []).map(label.vibe).join(", ")}</Td>
                  <Td className="text-white/75">{a.stops?.some((x) => x !== "dinner") ? label.music(a.music) : ""}</Td>
                  <Td>{/^\d{2}:\d{2}$/.test(a.start) ? friendlyTime(a.start) : ""}</Td>
                  <Td>
                    <Link href={`/plan/${s.plan_key}?admin=1`} className="text-white/85 underline underline-offset-4 hover:text-white">
                      Open plan
                    </Link>
                  </Td>
                </tr>
              );
            })}
          </Table>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Marked as booked">
            <Table head={["Night", "Venue", "Stop", "Party", "Marked"]} empty={u.bookings.length === 0 && "Nothing booked yet."}>
              {u.bookings.map((b) => (
                <tr key={`${b.venue_slug}-${b.night_date}`}>
                  <Td>{day(b.night_date)}</Td>
                  <Td>
                    <Link href={`/venues/${b.venue_slug}`} className="text-white hover:underline hover:underline-offset-4">
                      {b.venue ?? b.venue_slug}
                    </Link>
                  </Td>
                  <Td>{label.stop(b.stop)}</Td>
                  <Td num>{b.party_size ?? ""}</Td>
                  <Td className="text-white/75">{dayTime(b.created_at)}</Td>
                </tr>
              ))}
            </Table>
          </Panel>

          <Panel title="Clicks to venues" note={u.clicks.length >= 200 ? "Latest 200." : undefined}>
            <Table head={["When", "Venue", "Went to", "From"]} empty={u.clicks.length === 0 && "No clicks yet."}>
              {u.clicks.map((c, i) => (
                <tr key={`${c.created_at}-${i}`}>
                  <Td className="text-white/75">{dayTime(c.created_at)}</Td>
                  <Td>
                    <Link href={`/venues/${c.venue_slug}`} className="text-white hover:underline hover:underline-offset-4">
                      {c.venue ?? c.venue_slug}
                    </Link>
                  </Td>
                  <Td>{c.kind === "book" ? label.platform(c.platform ?? "other") : label.kind(c.kind)}</Td>
                  <Td className="text-white/75">{label.source(c.source)}</Td>
                </tr>
              ))}
            </Table>
          </Panel>
        </div>

        {u.visits.length > 0 && (
          <Panel title="Places they've been">
            <Table head={["Venue", "Visited"]}>
              {u.visits.map((v) => (
                <tr key={v.venue_slug}>
                  <Td>
                    <Link href={`/venues/${v.venue_slug}`} className="text-white hover:underline hover:underline-offset-4">
                      {v.venue ?? v.venue_slug}
                    </Link>
                  </Td>
                  <Td>{day(v.visited_on)}</Td>
                </tr>
              ))}
            </Table>
          </Panel>
        )}
      </div>
    </div>
  );
}
