import type { Metadata } from "next";
import Link from "next/link";
import { BookingsTab } from "@/app/control-center/tabs/bookings";
import { OverviewTab } from "@/app/control-center/tabs/overview";
import { PeopleTab } from "@/app/control-center/tabs/people";
import { PreferencesTab } from "@/app/control-center/tabs/preferences";
import { TrafficTab } from "@/app/control-center/tabs/traffic";
import { VenuesTab } from "@/app/control-center/tabs/venues";
import { parseRange, ranges, requireAdmin, sinceFor } from "@/app/control-center/data";
import { ccHref } from "@/app/control-center/href";
import { Pills } from "@/components/control-center/ui";

export const metadata: Metadata = {
  title: "Control Center",
  robots: { index: false, follow: false },
};

const tabs = [
  { key: "overview", label: "Overview", ranged: true },
  { key: "people", label: "People", ranged: false },
  { key: "preferences", label: "Preferences", ranged: true },
  { key: "traffic", label: "Traffic", ranged: true },
  { key: "bookings", label: "Bookings", ranged: true },
  { key: "venues", label: "Venues", ranged: false },
] as const;

type TabKey = (typeof tabs)[number]["key"];

// The admin's private dashboard: who signed up, what they look for, where we send
// them and what they book. Only info@planmynights.co.uk can open it.
export default async function ControlCenterPage(props: PageProps<"/control-center">) {
  const supabase = await requireAdmin();
  const query = await props.searchParams;
  const one = (k: string) => (typeof query[k] === "string" ? (query[k] as string) : undefined);

  const tab: TabKey = tabs.some((t) => t.key === one("tab")) ? (one("tab") as TabKey) : "overview";
  const range = parseRange(one("range"));
  const since = sinceFor(range);
  const current = tabs.find((t) => t.key === tab)!;
  const rangeLabel = ranges.find((r) => r.key === range)!.label;
  const updated = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 pb-24 sm:px-8 sm:pt-14">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm tracking-[0.2em] text-ash uppercase">Admin</p>
          <h1 className="mt-1 text-title font-light">Control Center</h1>
          <p className="mt-2 text-sm text-ash">
            Live from the database at {updated}.{" "}
            <Link href={ccHref({ tab, range })} className="text-white/85 underline underline-offset-4 hover:text-white">
              Refresh
            </Link>
          </p>
        </div>
        {current.ranged && (
          <Pills
            label="Date range"
            items={ranges.map((r) => ({
              href: ccHref({ tab, range: r.key, scope: one("scope") }),
              label: r.label,
              current: r.key === range,
            }))}
          />
        )}
      </header>

      <nav aria-label="Control Center sections" className="mt-8 -mx-4 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-7">
          {tabs.map((t) => (
            <li key={t.key}>
              <Link
                href={ccHref({ tab: t.key, range })}
                aria-current={t.key === tab ? "page" : undefined}
                className={`-mb-px inline-block border-b py-3 text-[0.9375rem] transition-colors ${
                  t.key === tab ? "border-white text-white" : "border-transparent text-ash hover:text-white"
                }`}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-8">
        {tab === "overview" && <OverviewTab supabase={supabase} since={since} rangeLabel={rangeLabel} range={range} />}
        {tab === "people" && <PeopleTab supabase={supabase} q={one("q")} filter={one("filter")} sort={one("sort")} />}
        {tab === "preferences" && <PreferencesTab supabase={supabase} since={since} range={range} scope={one("scope")} />}
        {tab === "traffic" && <TrafficTab supabase={supabase} since={since} rangeLabel={rangeLabel} />}
        {tab === "bookings" && <BookingsTab supabase={supabase} since={since} rangeLabel={rangeLabel} />}
        {tab === "venues" && <VenuesTab supabase={supabase} />}
      </div>
    </div>
  );
}
