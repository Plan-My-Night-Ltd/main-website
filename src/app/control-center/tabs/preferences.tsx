import type { SupabaseClient } from "@supabase/supabase-js";
import { call, type Count, type Preferences, type RangeKey } from "@/app/control-center/data";
import { ccHref } from "@/app/control-center/href";
import { label, num } from "@/components/control-center/labels";
import { BarList, Panel, Pills, SetupNotice } from "@/components/control-center/ui";

const rows = (counts: Count[], name: (k: string) => string) => counts.map((c) => ({ key: c.key ?? "none", label: name(c.key ?? ""), n: c.n }));

// What people pick in the questionnaire. "Booked nights" narrows it to searches for
// a night on which that person then marked a venue as booked.
export async function PreferencesTab({ supabase, since, range, scope }: {
  supabase: SupabaseClient;
  since: string | null;
  range: RangeKey;
  scope?: string;
}) {
  const bookedOnly = scope === "booked";
  const res = await call<Preferences>(supabase, "admin_preferences", { p_since: since, p_booked_only: bookedOnly });
  if (res.error !== null) return <SetupNotice error={res.error} />;
  const p = res.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Pills
          label="Which searches"
          items={[
            { href: ccHref({ tab: "preferences", range }), label: "All searches", current: !bookedOnly },
            { href: ccHref({ tab: "preferences", range, scope: "booked" }), label: "Nights that got booked", current: bookedOnly },
          ]}
        />
        <p className="text-sm text-ash">
          {num(p.total)} {p.total === 1 ? "search" : "searches"}
          {bookedOnly ? " for nights where a venue was then marked as booked" : ""}.
        </p>
      </div>

      {p.total === 0 ? (
        <p className="border border-line bg-raised p-6 text-ash">No searches in this period yet.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Panel title="Who it's for">
            <BarList rows={rows(p.group, label.group)} total={p.total} />
          </Panel>
          <Panel title="Shape of the night">
            <BarList rows={rows(p.shape, label.shape)} total={p.total} />
          </Panel>
          <Panel title="Budget per head">
            <BarList rows={rows(p.budget, label.budget)} total={p.total} />
          </Panel>
          <Panel title="Vibes" note="People can pick several, so these add up to more than the searches.">
            <BarList rows={rows(p.vibes, label.vibe)} total={p.total} empty="No vibes picked." />
          </Panel>
          <Panel title="Music" note="Asked when the night has drinks or dancing.">
            <BarList rows={rows(p.music, label.music)} empty="Not asked in these searches." />
          </Panel>
          <Panel title="Where" note="Top 15 areas and parts of London.">
            <BarList rows={rows(p.area, label.area)} total={p.total} />
          </Panel>
          <Panel title="Group size">
            <BarList rows={rows(p.party, (k) => (k === "Just one" ? k : `${k} people`))} total={p.total} />
          </Panel>
          <Panel title="Which night of the week">
            <BarList rows={rows(p.weekday, label.weekday)} total={p.total} />
          </Panel>
          <Panel title="Start time">
            <BarList rows={rows(p.start, label.start)} total={p.total} />
          </Panel>
          <Panel title="How far ahead they plan" note="Days between the search and the night itself.">
            <BarList rows={rows(p.lead, (k) => k)} total={p.total} />
          </Panel>
        </div>
      )}
    </div>
  );
}
