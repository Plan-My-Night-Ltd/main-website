import type { SupabaseClient } from "@supabase/supabase-js";
import { call, type Overview, type RangeKey } from "@/app/control-center/data";
import { ccHref } from "@/app/control-center/href";
import { label, num, pct } from "@/components/control-center/labels";
import { BarList, DailyChart, Panel, SetupNotice, Stat, StatGrid } from "@/components/control-center/ui";

export async function OverviewTab({ supabase, since, rangeLabel, range }: {
  supabase: SupabaseClient;
  since: string | null;
  rangeLabel: string;
  range: RangeKey;
}) {
  const res = await call<Overview>(supabase, "admin_overview", { p_since: since });
  if (res.error !== null) return <SetupNotice error={res.error} />;
  const o = res.data;

  const period = range === "all" ? "all time" : `the last ${rangeLabel.toLowerCase()}`;
  const series = o.series ?? [];
  const sum = (k: "signups" | "searches" | "clicks" | "bookings") => series.reduce((s, p) => s + p[k], 0);
  const points = (k: "signups" | "searches" | "clicks" | "bookings") => series.map((p) => ({ day: p.day, n: p[k] }));
  const chartNote = range === "all" ? "Charts show the last 90 days." : undefined;

  return (
    <div className="space-y-10">
      <section aria-label="Headline numbers">
        <p className="mb-4 text-sm text-ash">Numbers for {period}, London time.</p>
        <StatGrid>
          <Stat
            label="New sign-ups"
            value={num(o.users_new)}
            note={`${num(o.users_total)} accounts in total`}
            href={ccHref({ tab: "people" })}
          />
          <Stat label="Searches" value={num(o.searches)} note={`by ${num(o.searchers)} people`} href={ccHref({ tab: "preferences", range })} />
          <Stat label="Nights planned" value={num(o.nights_planned)} note="different person and date pairs" />
          <Stat label="Active people" value={num(o.active_users)} note="searched, returned to a plan, clicked or booked" />
          <Stat
            label="Returning people"
            value={num(o.returning_active)}
            note={`${pct(o.returning_active, o.active_users)} of active people came on 2+ days`}
            href={ccHref({ tab: "people", filter: "returning" })}
          />
          <Stat
            label="Clicks to venues"
            value={num(o.clicks)}
            note={`${num(o.booking_clicks)} to booking pages`}
            href={ccHref({ tab: "traffic", range })}
          />
          <Stat
            label="Marked as booked"
            value={num(o.bookings)}
            note={`${num(o.covers)} covers, ${num(o.bookers)} people`}
            href={ccHref({ tab: "bookings", range })}
          />
          <Stat label="Upcoming booked nights" value={num(o.upcoming_bookings)} note="venues booked for tonight or later" />
        </StatGrid>
      </section>

      <section aria-label="Day by day">
        {chartNote && <p className="mb-4 text-sm text-ash">{chartNote}</p>}
        <div className="grid gap-3 md:grid-cols-2">
          <DailyChart title="Sign-ups per day" total={sum("signups")} points={points("signups")} />
          <DailyChart title="Searches per day" total={sum("searches")} points={points("searches")} />
          <DailyChart title="Clicks to venues per day" total={sum("clicks")} points={points("clicks")} />
          <DailyChart title="Marked as booked per day" total={sum("bookings")} points={points("bookings")} />
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title="From search to booking" note={`People at each step in ${period}.`}>
          <BarList
            total={o.searchers}
            rows={[
              { key: "searched", label: "Searched", n: o.searchers },
              { key: "clicked", label: "Clicked through to a venue", n: o.clickers },
              { key: "booked", label: "Marked a venue as booked", n: o.bookers },
            ]}
          />
          <p className="mt-5 text-sm text-ash">
            {num(o.anonymous_clicks)} more clicks came from people who weren&apos;t signed in (venue pages and shared plans).
          </p>
        </Panel>

        <Panel title="How people sign up" note={`New accounts in ${period}.`}>
          <BarList
            empty="No sign-ups in this period."
            rows={Object.entries(o.providers)
              .sort((a, b) => b[1] - a[1])
              .map(([k, n]) => ({ key: k, label: label.provider(k), n }))}
          />
        </Panel>

        <Panel title="Mailing list" note="Everyone who said yes to emails, at any time.">
          <p className="text-4xl font-light tabular-nums text-white">{num(o.opted_in)}</p>
          <p className="mt-1 text-sm text-ash">{pct(o.opted_in, o.users_total)} of all accounts</p>
          <a
            href="/control-center/export?type=mailing-list"
            className="mt-6 inline-flex rounded-full border border-white/35 px-4 py-1.5 text-sm text-white transition-colors hover:border-white"
          >
            Download mailing list (CSV)
          </a>
          <p className="mt-6 text-sm text-ash">
            {num(o.returning_total)} of {num(o.ever_active)} people who have ever used the planner have come back on another
            day ({pct(o.returning_total, o.ever_active)}).
          </p>
        </Panel>
      </div>
    </div>
  );
}
