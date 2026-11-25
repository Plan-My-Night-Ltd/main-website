import type { SupabaseClient } from "@supabase/supabase-js";
import { call, type Count, type Preferences } from "@/app/control-center/data";
import { ColumnChart, SegmentedBar, type Part } from "@/components/control-center/charts";
import { label, num, pct } from "@/components/control-center/labels";
import { Switcher } from "@/components/control-center/shell";
import { BarList, Panel, SetupNotice } from "@/components/control-center/ui";

const parts = (counts: Count[], name: (k: string) => string): Part[] =>
  counts.map((c) => ({ key: c.key ?? "none", label: name(c.key ?? ""), n: c.n }));

const shortDay = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// What people pick in the questionnaire. Both views (every search, and only nights
// that went on to be booked) load together, so flipping between them is instant.
export async function PreferencesTab({ supabase, since }: { supabase: SupabaseClient; since: string | null }) {
  const [all, booked] = await Promise.all([
    call<Preferences>(supabase, "admin_preferences", { p_since: since, p_booked_only: false }),
    call<Preferences>(supabase, "admin_preferences", { p_since: since, p_booked_only: true }),
  ]);
  if (all.error !== null) return <SetupNotice error={all.error} />;
  if (booked.error !== null) return <SetupNotice error={booked.error} />;

  const count = (p: Preferences, suffix = "") => (
    <p className="text-sm text-ash">
      {num(p.total)} {p.total === 1 ? "search" : "searches"}
      {suffix}.
    </p>
  );

  return (
    <Switcher
      label="Which searches"
      options={[
        { key: "all", label: "All searches" },
        { key: "booked", label: "Nights that got booked" },
      ]}
      panels={{ all: <PreferencesView p={all.data} />, booked: <PreferencesView p={booked.data} /> }}
      aside={{ all: count(all.data), booked: count(booked.data, " for nights where a venue was then marked as booked") }}
    />
  );
}

function PreferencesView({ p }: { p: Preferences }) {
  if (p.total === 0) return <p className="border border-line bg-raised p-6 text-ash">No searches in this period yet.</p>;

  const top = (counts: Count[]) => [...counts].sort((a, b) => b.n - a.n)[0];
  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const n = p.weekday.find((w) => Number(w.key) === i + 1)?.n ?? 0;
    return { key: String(i + 1), label: label.weekday(i + 1), short: shortDay[i], n };
  });
  const hours = p.start.map((s) => Number(s.key.slice(0, 2))).filter((h) => !Number.isNaN(h));
  const starts = hours.length
    ? Array.from({ length: Math.max(...hours) - Math.min(...hours) + 1 }, (_, i) => {
        const h = Math.min(...hours) + i;
        const key = `${String(h).padStart(2, "0")}:00`;
        const name = label.start(key);
        return { key, label: name, short: name, n: p.start.find((s) => s.key === key)?.n ?? 0 };
      })
    : [];

  const glance: { title: string; c: Count | undefined; name: (k: string) => string }[] = [
    { title: "Mostly for", c: top(p.group), name: label.group },
    { title: "Usual night", c: top(p.shape), name: label.shape },
    { title: "Usual budget", c: top(p.budget), name: (k) => label.budget(k) },
    { title: "Favourite area", c: top(p.area), name: label.area },
    { title: "Busiest night", c: top(p.weekday), name: (k) => label.weekday(k) },
    { title: "Usual start", c: top(p.start), name: label.start },
    { title: "Top vibe", c: top(p.vibes), name: label.vibe },
    { title: "Plan ahead by", c: top(p.lead), name: (k) => k },
  ];

  return (
    <div className="space-y-3">
      <Panel title="At a glance" note="The most common answer to each question, and its share of searches.">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
          {glance.map((g) => (
            <div key={g.title}>
              <dt className="text-sm text-ash">{g.title}</dt>
              <dd className="mt-1 text-lg leading-snug font-light text-white">
                {g.c ? g.name(g.c.key) : "–"}
                {g.c && <span className="ml-2 text-sm text-ash tabular-nums">{pct(g.c.n, p.total)}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </Panel>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="Who it's for">
          <SegmentedBar label="Who it's for" parts={parts(p.group, label.group)} />
        </Panel>
        <Panel title="Shape of the night">
          <SegmentedBar label="Shape of the night" parts={parts(p.shape, label.shape)} />
        </Panel>
        <Panel title="Budget per head">
          <SegmentedBar label="Budget per head" kind="ordinal" parts={parts(p.budget, label.budget)} />
        </Panel>
        <Panel title="Group size">
          <SegmentedBar label="Group size" kind="ordinal" parts={parts(p.party, (k) => (k === "Just one" ? k : `${k} people`))} />
        </Panel>
        <Panel title="Music" note="Asked when the night has drinks or dancing.">
          <SegmentedBar label="Music" parts={parts(p.music, label.music)} />
        </Panel>
        <Panel title="How far ahead they plan" note="Days between the search and the night.">
          <SegmentedBar label="How far ahead they plan" kind="ordinal" parts={parts(p.lead, (k) => k)} />
        </Panel>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Panel title="Which night of the week">
          <ColumnChart label="Searches by night of the week" points={weekdays} />
        </Panel>
        <Panel title="Start time">
          <ColumnChart label="Searches by start time" points={starts} />
        </Panel>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Panel title="Vibes" note="People can pick several, so shares add up to more than 100%.">
          <BarList rows={parts(p.vibes, label.vibe)} total={p.total} empty="No vibes picked." />
        </Panel>
        <Panel title="Where" note="Top 15 areas and parts of London.">
          <BarList rows={parts(p.area, label.area)} total={p.total} />
        </Panel>
      </div>
    </div>
  );
}
