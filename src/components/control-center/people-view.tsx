"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { num } from "@/components/control-center/fmt";
import { ChoicePills, useControlCenter, type PeopleFilter } from "@/components/control-center/shell";
import { Panel, Table, Td, Tick } from "@/components/control-center/ui";

// The People list. Everyone arrives with the page, so filters, sorting and search
// run in the browser and answer as you type.

export type PersonRow = {
  id: string;
  name: string | null;
  email: string | null;
  signedUpAt: string;
  signedUp: string; // "25 Nov 2026"
  provider: string; // "Google"
  searches: number;
  nights: number;
  days: number;
  returned: boolean;
  clicks: number;
  bookings: number;
  lastActiveOn: string | null;
  lastActive: string;
  usually: string;
  optIn: boolean | null;
};

const filters: { key: PeopleFilter; label: string; test: (p: PersonRow) => boolean }[] = [
  { key: "all", label: "Everyone", test: () => true },
  { key: "returning", label: "Returning", test: (p) => p.returned },
  { key: "booked", label: "Booked something", test: (p) => p.bookings > 0 },
  { key: "emails", label: "Said yes to emails", test: (p) => p.optIn === true },
  { key: "inactive", label: "Never searched", test: (p) => p.searches === 0 },
];

const sorts = [
  { key: "recent", label: "Newest", by: (a: PersonRow, b: PersonRow) => b.signedUpAt.localeCompare(a.signedUpAt) },
  { key: "active", label: "Last active", by: (a: PersonRow, b: PersonRow) => (b.lastActiveOn ?? "").localeCompare(a.lastActiveOn ?? "") },
  { key: "searches", label: "Most searches", by: (a: PersonRow, b: PersonRow) => b.searches - a.searches || b.nights - a.nights },
  { key: "days", label: "Most days active", by: (a: PersonRow, b: PersonRow) => b.days - a.days },
  { key: "bookings", label: "Most bookings", by: (a: PersonRow, b: PersonRow) => b.bookings - a.bookings || b.clicks - a.clicks },
] as const;

type SortKey = (typeof sorts)[number]["key"];

const shown = 300;

export function PeopleView({ rows }: { rows: PersonRow[] }) {
  const { peopleFilter, setPeopleFilter } = useControlCenter();
  const [sort, setSort] = useState<SortKey>("recent");
  const [query, setQuery] = useState("");
  const needle = useDeferredValue(query.trim().toLowerCase());

  const list = useMemo(() => {
    const f = filters.find((x) => x.key === peopleFilter) ?? filters[0];
    const s = sorts.find((x) => x.key === sort)!;
    return rows
      .filter(f.test)
      .filter((p) => !needle || `${p.name ?? ""} ${p.email ?? ""}`.toLowerCase().includes(needle))
      .sort(s.by);
  }, [rows, peopleFilter, sort, needle]);

  return (
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
        <ChoicePills label="Filter people" value={peopleFilter} onChange={setPeopleFilter} options={filters} />
        <label className="sr-only" htmlFor="people-q">
          Search by name or email
        </label>
        <input
          id="people-q"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or email"
          className="w-full rounded-full border border-white/25 bg-black px-4 py-1.5 text-sm text-white placeholder:text-ash focus:border-white focus:outline-none lg:w-64"
        />
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm" role="group" aria-label="Sort people">
        <span className="text-ash">Sort:</span>
        {sorts.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => setSort(x.key)}
            aria-pressed={x.key === sort}
            className={x.key === sort ? "text-white underline underline-offset-4" : "text-white/70 hover:text-white"}
          >
            {x.label}
          </button>
        ))}
        <span className="ml-auto text-ash" aria-live="polite">
          {num(list.length)} {list.length === 1 ? "person" : "people"}
        </span>
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
              {u.signedUp}
              <span className="block text-ash">with {u.provider}</span>
            </Td>
            <Td num>{num(u.searches)}</Td>
            <Td num>{num(u.nights)}</Td>
            <Td num>{num(u.days)}</Td>
            <Td>
              <Tick on={u.returned} />
            </Td>
            <Td num>{num(u.clicks)}</Td>
            <Td num>{num(u.bookings)}</Td>
            <Td>{u.lastActive}</Td>
            <Td className="text-white/75">
              <span className="block w-48 whitespace-normal">{u.usually}</span>
            </Td>
            <Td>
              <Tick on={u.optIn} no={u.optIn === false ? "No" : "Not asked"} />
            </Td>
          </tr>
        ))}
      </Table>
    </Panel>
  );
}
