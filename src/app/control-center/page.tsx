import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { parseRange, ranges, requireAdmin, sinceFor } from "@/app/control-center/data";
import { BookingsTab } from "@/app/control-center/tabs/bookings";
import { OverviewTab } from "@/app/control-center/tabs/overview";
import { PeopleTab } from "@/app/control-center/tabs/people";
import { PreferencesTab } from "@/app/control-center/tabs/preferences";
import { TrafficTab } from "@/app/control-center/tabs/traffic";
import { VenuesTab } from "@/app/control-center/tabs/venues";
import { ControlCenterShell } from "@/components/control-center/shell";
import { tabs, type TabKey } from "@/components/control-center/tabs";
import { TabSkeleton } from "@/components/control-center/skeleton";

export const metadata: Metadata = {
  title: "Control Center",
  robots: { index: false, follow: false },
};

// The admin's private dashboard: who signed up, what they look for, where we send
// them and what they book. Only info@planmynights.co.uk can open it.
//
// Every tab's data is fetched at once, in parallel, and streams in as it's ready,
// so switching tabs in the browser is instant. Only a new date range or Refresh
// comes back here.
export default async function ControlCenterPage(props: PageProps<"/control-center">) {
  const supabase = await requireAdmin();
  const query = await props.searchParams;
  const one = (k: string) => (typeof query[k] === "string" ? (query[k] as string) : undefined);

  const initialTab: TabKey = tabs.some((t) => t.key === one("tab")) ? (one("tab") as TabKey) : "overview";
  const range = parseRange(one("range"));
  const since = sinceFor(range);
  const rangeLabel = ranges.find((r) => r.key === range)!.label;
  const updatedAt = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

  const stream = (node: ReactNode) => <Suspense fallback={<TabSkeleton />}>{node}</Suspense>;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 pb-24 sm:px-8 sm:pt-14">
      <ControlCenterShell
        // A new range is a new set of numbers; the shell keeps its tab and filters.
        initialTab={initialTab}
        range={range}
        ranges={ranges.map((r) => ({ key: r.key, label: r.label }))}
        updatedAt={updatedAt}
        panels={{
          overview: stream(<OverviewTab supabase={supabase} since={since} rangeLabel={rangeLabel} range={range} />),
          people: stream(<PeopleTab supabase={supabase} />),
          preferences: stream(<PreferencesTab supabase={supabase} since={since} />),
          traffic: stream(<TrafficTab supabase={supabase} since={since} rangeLabel={rangeLabel} />),
          bookings: stream(<BookingsTab supabase={supabase} since={since} rangeLabel={rangeLabel} />),
          venues: stream(<VenuesTab supabase={supabase} />),
        }}
      />
    </div>
  );
}
