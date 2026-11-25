"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useOptimistic, useState, useTransition, type MouseEvent, type ReactNode } from "react";
import { ccHref } from "@/app/control-center/href";

// The Control Center's frame, run in the browser so it responds the moment you click.
// Every tab's data arrives with the page, so switching tabs never waits on the server;
// only the date range and Refresh fetch new numbers, and the page shows that it's
// updating while they do.

export const tabs = [
  { key: "overview", label: "Overview", ranged: true },
  { key: "people", label: "People", ranged: false },
  { key: "preferences", label: "Preferences", ranged: true },
  { key: "traffic", label: "Traffic", ranged: true },
  { key: "bookings", label: "Bookings", ranged: true },
  { key: "venues", label: "Venues", ranged: false },
] as const;

export type TabKey = (typeof tabs)[number]["key"];
export type PeopleFilter = "all" | "returning" | "booked" | "emails" | "inactive";

type Ctx = {
  tab: TabKey;
  go: (tab: TabKey, peopleFilter?: PeopleFilter) => void;
  peopleFilter: PeopleFilter;
  setPeopleFilter: (f: PeopleFilter) => void;
};

const ControlCenterContext = createContext<Ctx | null>(null);

export function useControlCenter(): Ctx {
  const ctx = useContext(ControlCenterContext);
  if (!ctx) throw new Error("useControlCenter must be used inside the Control Center");
  return ctx;
}

export function ControlCenterShell({
  initialTab,
  range,
  ranges,
  updatedAt,
  panels,
}: {
  initialTab: TabKey;
  range: string;
  ranges: { key: string; label: string }[];
  updatedAt: string;
  panels: Record<TabKey, ReactNode>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [peopleFilter, setPeopleFilter] = useState<PeopleFilter>("all");
  const [pending, startTransition] = useTransition();
  // The range pill switches at once; the real value catches up when the new numbers arrive.
  const [shownRange, setShownRange] = useOptimistic(range);
  const ranged = tabs.find((t) => t.key === tab)!.ranged;

  function go(next: TabKey, filter?: PeopleFilter) {
    setTab(next);
    if (filter) setPeopleFilter(filter);
    window.history.replaceState(null, "", ccHref({ tab: next, range }));
    window.scrollTo({ top: 0 });
  }

  function pickRange(next: string) {
    if (next === range) return;
    startTransition(() => {
      setShownRange(next);
      router.push(ccHref({ tab, range: next }), { scroll: false });
    });
  }

  function refresh() {
    startTransition(() => router.refresh());
  }

  return (
    <ControlCenterContext.Provider value={{ tab, go, peopleFilter, setPeopleFilter }}>
      {/* A thin bar across the top while new numbers load. */}
      <div aria-hidden className={`fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden ${pending ? "" : "invisible"}`}>
        <div className="h-full w-1/3 bg-white motion-safe:animate-[cc-progress_1s_ease-in-out_infinite]" />
      </div>

      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm tracking-[0.2em] text-ash uppercase">Admin</p>
          <h1 className="mt-1 text-title font-light">Control Center</h1>
          <p className="mt-2 text-sm text-ash" aria-live="polite">
            {pending ? (
              "Updating…"
            ) : (
              <>
                Live from the database at {updatedAt}.{" "}
                <button type="button" onClick={refresh} className="text-white/85 underline underline-offset-4 hover:text-white">
                  Refresh
                </button>
              </>
            )}
          </p>
        </div>
        {ranged && (
          <ChoicePills
            label="Date range"
            value={shownRange}
            onChange={pickRange}
            options={ranges.map((r) => ({ key: r.key, label: r.label }))}
          />
        )}
      </header>

      <nav aria-label="Control Center sections" className="mt-8 -mx-4 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-7">
          {tabs.map((t) => (
            <li key={t.key}>
              <a
                href={ccHref({ tab: t.key, range })}
                onClick={(e) => {
                  if (plainClick(e)) {
                    e.preventDefault();
                    go(t.key);
                  }
                }}
                aria-current={t.key === tab ? "page" : undefined}
                className={`-mb-px inline-block border-b py-3 text-[0.9375rem] transition-colors ${
                  t.key === tab ? "border-white text-white" : "border-transparent text-ash hover:text-white"
                }`}
              >
                {t.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div
        aria-busy={pending}
        className={`mt-8 transition-opacity duration-150 ${pending ? "pointer-events-none opacity-50" : ""}`}
      >
        {panels[tab]}
      </div>
    </ControlCenterContext.Provider>
  );
}

/** Ordinary left click, so ctrl/cmd-click can still open a tab in a new window. */
function plainClick(e: MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

/** A link to another tab (optionally a People filter) that switches instantly. */
export function TabLink({
  tab,
  filter,
  className,
  children,
}: {
  tab: TabKey;
  filter?: PeopleFilter;
  className?: string;
  children: ReactNode;
}) {
  const { go } = useControlCenter();
  return (
    <a
      href={ccHref({ tab })}
      className={className}
      onClick={(e) => {
        if (plainClick(e)) {
          e.preventDefault();
          go(tab, filter);
        }
      }}
    >
      {children}
    </a>
  );
}

/** Pill buttons for picking one option. The chosen one is filled. */
export function ChoicePills<K extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: K;
  onChange: (key: K) => void;
  options: { key: K; label: string }[];
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          aria-pressed={o.key === value}
          className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
            o.key === value ? "border-white bg-white text-black" : "border-white/25 text-white/85 hover:border-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Two or more ready-made views of the same thing, flipped between in the browser. */
export function Switcher({
  label,
  options,
  panels,
  aside,
}: {
  label: string;
  options: { key: string; label: string }[];
  panels: Record<string, ReactNode>;
  aside?: Record<string, ReactNode>;
}) {
  const [value, setValue] = useState(options[0].key);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <ChoicePills label={label} value={value} onChange={setValue} options={options} />
        {aside?.[value]}
      </div>
      {panels[value]}
    </div>
  );
}
