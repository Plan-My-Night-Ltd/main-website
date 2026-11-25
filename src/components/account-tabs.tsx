"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";

export type AccountTab = { id: string; label: string; count: number; content: ReactNode };

// Tabs on the account page. Both panels arrive with the page, so switching is
// instant: no trip to the server. The address bar follows along (?tab=places) so
// a refresh or a shared link lands on the same tab.
export function AccountTabs({ tabs, initial }: { tabs: AccountTab[]; initial: string }) {
  const [active, setActive] = useState(tabs.some((t) => t.id === initial) ? initial : tabs[0].id);

  function select(id: string) {
    setActive(id);
    const url = new URL(window.location.href);
    if (id === tabs[0].id) url.searchParams.delete("tab");
    else url.searchParams.set("tab", id);
    window.history.replaceState(window.history.state, "", url);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const i = tabs.findIndex((t) => t.id === active);
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    select(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Your account"
        onKeyDown={onKeyDown}
        className="grid grid-cols-2 rounded-full border border-line p-1 text-[0.9375rem]"
      >
        {tabs.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(t.id)}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-full px-3 transition-colors duration-150 ${
                selected ? "bg-white text-black" : "text-white/75 hover:text-white"
              }`}
            >
              {t.label}
              {t.count > 0 && <span className={`text-sm ${selected ? "text-black/55" : "text-ash"}`}>{t.count}</span>}
            </button>
          );
        })}
      </div>

      {tabs.map((t) => (
        <div
          key={t.id}
          id={`panel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${t.id}`}
          hidden={t.id !== active}
          className="mt-8"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
