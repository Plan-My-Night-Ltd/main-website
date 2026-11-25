import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { call, type AdminUser } from "@/app/control-center/data";
import { ccHref } from "@/app/control-center/href";
import { day, label, num, pct } from "@/components/control-center/labels";
import { Panel, Pills, SetupNotice, Stat, StatGrid, Table, Td, Tick } from "@/components/control-center/ui";

const filters = [
  { key: "all", label: "Everyone", test: () => true },
  { key: "returning", label: "Returning", test: (u: AdminUser) => u.returned },
  { key: "booked", label: "Booked something", test: (u: AdminUser) => u.bookings > 0 },
  { key: "emails", label: "Said yes to emails", test: (u: AdminUser) => u.marketing_opt_in === true },
  { key: "inactive", label: "Never searched", test: (u: AdminUser) => u.searches === 0 },
] as const;

const sorts = [
  { key: "recent", label: "Newest", by: (a: AdminUser, b: AdminUser) => b.signed_up_at.localeCompare(a.signed_up_at) },
  { key: "active", label: "Last active", by: (a: AdminUser, b: AdminUser) => (b.last_active_on ?? "").localeCompare(a.last_active_on ?? "") },
  { key: "searches", label: "Most searches", by: (a: AdminUser, b: AdminUser) => b.searches - a.searches || b.nights_planned - a.nights_planned },
  { key: "days", label: "Most days active", by: (a: AdminUser, b: AdminUser) => b.days_active - a.days_active },
  { key: "bookings", label: "Most bookings", by: (a: AdminUser, b: AdminUser) => b.bookings - a.bookings || b.clicks - a.clicks },
] as const;

const shown = 300;

export async function PeopleTab({ supabase, q, filter, sort }: {
  supabase: SupabaseClient;
  q?: string;
  filter?: string;
  sort?: string;
}) {
  const res = await call<AdminUser[]>(supabase, "admin_users");
  if (res.error !== null) return <SetupNotice error={res.error} />;
  const users = res.data;

  const f = filters.find((x) => x.key === filter) ?? filters[0];
  const s = sorts.find((x) => x.key === sort) ?? sorts[0];
  const needle = (q ?? "").trim().toLowerCase();
  const list = users
    .filter(f.test)
    .filter((u) => !needle || `${u.name ?? ""} ${u.email ?? ""}`.toLowerCase().includes(needle))
    .sort(s.by);

  const searched = users.filter((u) => u.searches > 0).length;
  const returning = users.filter((u) => u.returned).length;
  const href = (changes: Record<string, string | undefined>) =>
    ccHref({ tab: "people", q: q || undefined, filter: f.key === "all" ? undefined : f.key, sort: s.key === "recent" ? undefined : s.key, ...changes });

  return (
    <div className="space-y-8">
      <StatGrid>
        <Stat label="Accounts" value={num(users.length)} note={`${num(users.filter((u) => !u.confirmed).length)} haven't confirmed their email`} />
        <Stat label="Have searched" value={num(searched)} note={`${pct(searched, users.length)} of accounts`} />
        <Stat label="Returning" value={num(returning)} note={`${pct(returning, searched)} of people who searched`} />
        <Stat label="Said yes to emails" value={num(users.filter((u) => u.marketing_opt_in).length)} />
      </StatGrid>

      <Panel
        title="Everyone who signed up"
        note="Returning means active on two or more different days. Click a person to see every search, click and booking."
        action={
          <a href="/control-center/export?type=people" className="text-sm text-white/85 underline underline-offset-4 hover:text-white">
            Download all (CSV)
          </a>
        }
      >
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Pills label="Filter people" items={filters.map((x) => ({ href: href({ filter: x.key === "all" ? undefined : x.key }), label: x.label, current: x.key === f.key }))} />
          <form action="/control-center" className="flex gap-2">
            <input type="hidden" name="tab" value="people" />
            {f.key !== "all" && <input type="hidden" name="filter" value={f.key} />}
            {s.key !== "recent" && <input type="hidden" name="sort" value={s.key} />}
            <label className="sr-only" htmlFor="people-q">
              Search by name or email
            </label>
            <input
              id="people-q"
              name="q"
              defaultValue={q}
              placeholder="Name or email"
              className="w-56 rounded-full border border-white/25 bg-black px-4 py-1.5 text-sm text-white placeholder:text-ash focus:border-white focus:outline-none"
            />
            <button type="submit" className="rounded-full border border-white/35 px-4 py-1.5 text-sm text-white hover:border-white">
              Search
            </button>
          </form>
        </div>
        <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <span className="text-ash">Sort:</span>
          {sorts.map((x) => (
            <Link
              key={x.key}
              href={href({ sort: x.key === "recent" ? undefined : x.key })}
              scroll={false}
              aria-current={x.key === s.key ? "true" : undefined}
              className={x.key === s.key ? "text-white underline underline-offset-4" : "text-white/70 hover:text-white"}
            >
              {x.label}
            </Link>
          ))}
        </div>

        <Table
          head={["Person", "Signed up", "Searches", "Nights", "Days active", "Returning", "Clicks", "Booked", "Last active", "Usually picks", "Emails"]}
          empty={list.length === 0 ? "Nobody matches." : list.length > shown ? `Showing the first ${shown} of ${num(list.length)}. Download the CSV for everyone.` : false}
        >
          {list.slice(0, shown).map((u) => (
            <tr key={u.id} className="hover:bg-white/[0.03]">
              <Td>
                <Link href={`/control-center/people/${u.id}`} className="group block">
                  <span className="text-white group-hover:underline group-hover:underline-offset-4">{u.name || u.email}</span>
                  {u.name && <span className="block text-ash">{u.email}</span>}
                </Link>
              </Td>
              <Td>
                {day(u.signed_up_at)}
                <span className="block text-ash">with {label.provider(u.provider)}</span>
              </Td>
              <Td num>{num(u.searches)}</Td>
              <Td num>{num(u.nights_planned)}</Td>
              <Td num>{num(u.days_active)}</Td>
              <Td>
                <Tick on={u.returned} />
              </Td>
              <Td num>{num(u.clicks)}</Td>
              <Td num>{num(u.bookings)}</Td>
              <Td>{day(u.last_active_on)}</Td>
              <Td className="text-white/75">
                <span className="block w-48 whitespace-normal">
                  {u.searches > 0
                    ? [label.area(u.usual_area), label.budgetShort(u.usual_budget), u.usual_group && label.group(u.usual_group).toLowerCase(), u.avg_party_size && `avg. ${u.avg_party_size} people`]
                        .filter(Boolean)
                        .join(", ")
                    : ""}
                </span>
              </Td>
              <Td>
                <Tick on={u.marketing_opt_in} no={u.marketing_opt_in === false ? "No" : "Not asked"} />
              </Td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
