import Link from "next/link";
import type { ReactNode } from "react";
import { day, num, pct } from "@/components/control-center/labels";

// Building blocks for the Control Center. Same black, white and hairlines as the
// rest of the site; every chart is a single series in white, so the title names it
// and no legend is needed. Each mark shows its exact value on hover or focus.

export function Panel({ title, note, action, children, className = "" }: {
  title: string;
  note?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border border-line bg-raised p-5 sm:p-6 ${className}`}>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-light text-white">{title}</h2>
        {action}
      </div>
      {note && <p className="-mt-3 mb-5 text-sm text-ash">{note}</p>}
      {children}
    </section>
  );
}

/** A headline number. `note` is the context under it, e.g. "of 120 signed up". */
export function Stat({ label, value, note, href }: { label: string; value: ReactNode; note?: ReactNode; href?: string }) {
  const body = (
    <>
      <p className="text-sm text-ash">{label}</p>
      <p className="mt-1 text-3xl font-light tabular-nums text-white sm:text-4xl">{value}</p>
      {note && <p className="mt-1 text-sm text-ash">{note}</p>}
    </>
  );
  const cls = "block border border-line bg-raised p-5";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:border-white/40`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{children}</div>;
}

/** Ranked horizontal bars: label and count on one line, a thin bar under it. */
export function BarList({ rows, total, empty = "Nothing yet." }: {
  rows: { key: string; label: ReactNode; n: number; extra?: ReactNode }[];
  total?: number;
  empty?: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-ash">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.n), 1);
  const whole = total ?? rows.reduce((sum, r) => sum + r.n, 0);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key} className="group" title={`${r.n.toLocaleString("en-GB")} (${pct(r.n, whole)})`}>
          <div className="flex items-baseline justify-between gap-4 text-[0.9375rem]">
            <span className="min-w-0 truncate text-white/85">{r.label}</span>
            <span className="shrink-0 tabular-nums text-white">
              {num(r.n)} <span className="text-sm text-ash">{pct(r.n, whole)}</span>
              {r.extra}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-white/80 transition-colors group-hover:bg-white"
              style={{ width: `${Math.max((r.n / max) * 100, r.n > 0 ? 1.5 : 0)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Daily column chart for one measure. Columns sit on a baseline; hover shows the day and value. */
export function DailyChart({ title, total, points }: { title: string; total: number; points: { day: string; n: number }[] }) {
  const max = Math.max(...points.map((p) => p.n), 0);
  const top = niceCeil(max);
  return (
    <figure className="border border-line bg-raised p-5">
      <figcaption className="flex items-baseline justify-between gap-4">
        <span className="text-[0.9375rem] text-white/85">{title}</span>
        <span className="text-2xl font-light tabular-nums text-white">{num(total)}</span>
      </figcaption>
      <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-2">
        <div className="flex h-28 flex-col justify-between text-right text-xs tabular-nums text-ash">
          <span>{num(top)}</span>
          <span>0</span>
        </div>
        <div className="relative h-28 border-b border-white/30">
          <span className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-white/10" aria-hidden />
          <ol className="absolute inset-0 flex items-end gap-[2px]" aria-label={`${title} per day`}>
            {points.map((p) => (
              <li key={p.day} className="group relative flex h-full min-w-0 flex-1 items-end" tabIndex={0}>
                <span
                  className="block w-full rounded-t-[4px] bg-white/75 transition-colors group-hover:bg-white group-focus:bg-white"
                  style={{ height: top ? `${(p.n / top) * 100}%` : 0 }}
                />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded border border-line bg-black px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block group-focus:block">
                  {day(p.day)}: <span className="tabular-nums">{num(p.n)}</span>
                </span>
                <span className="sr-only">
                  {day(p.day)}: {p.n}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <span />
        <div className="mt-1.5 flex justify-between text-xs text-ash">
          <span>{day(points[0]?.day)}</span>
          <span>{day(points[points.length - 1]?.day)}</span>
        </div>
      </div>
    </figure>
  );
}

function niceCeil(n: number): number {
  if (n <= 0) return 0;
  if (n <= 5) return n;
  const pow = 10 ** Math.floor(Math.log10(n));
  for (const step of [1, 2, 2.5, 5, 10]) if (n <= step * pow) return step * pow;
  return 10 * pow;
}

/** A scrollable data table with the dashboard's hairlines. */
export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: string | false }) {
  return (
    <div className="-mx-5 overflow-x-auto sm:-mx-6">
      <table className="w-full min-w-max text-left text-sm">
        <thead>
          <tr className="border-b border-line text-ash">
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-5 pb-3 font-normal whitespace-nowrap first:pl-5 sm:first:pl-6 last:pr-5 sm:last:pr-6">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty && <p className="px-5 pt-4 text-sm text-ash sm:px-6">{empty}</p>}
    </div>
  );
}

export function Td({ children, className = "", num: isNum }: { children?: ReactNode; className?: string; num?: boolean }) {
  return (
    <td className={`px-5 py-3 align-top whitespace-nowrap first:pl-5 sm:first:pl-6 last:pr-5 sm:last:pr-6 ${isNum ? "tabular-nums" : ""} ${className}`}>
      {children}
    </td>
  );
}

/** A small yes/no marker that never relies on colour alone. */
export function Tick({ on, yes = "Yes", no = "" }: { on: boolean | null | undefined; yes?: string; no?: string }) {
  return on ? (
    <span className="inline-flex items-center gap-1.5 text-white">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {yes}
    </span>
  ) : (
    <span className="text-ash">{no}</span>
  );
}

/** Pill links, e.g. the date range or a filter. The current one is filled. */
export function Pills({ items, label }: { items: { href: string; label: string; current: boolean }[]; label: string }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          scroll={false}
          aria-current={i.current ? "true" : undefined}
          className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
            i.current ? "border-white bg-white text-black" : "border-white/25 text-white/85 hover:border-white"
          }`}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

/** Shown in place of a section when the database isn't ready, e.g. the migration hasn't run. */
export function SetupNotice({ error }: { error: string }) {
  return (
    <div className="border border-danger/40 bg-raised p-6">
      <h2 className="text-lg font-light text-white">This section couldn&apos;t load</h2>
      <p className="mt-2 text-sm text-ash">
        If this is the first time you&apos;ve opened the Control Center, apply the database migration{" "}
        <code className="text-white">supabase/migrations/20261125000100_control_center.sql</code> (for example with{" "}
        <code className="text-white">supabase db push</code>) and reload.
      </p>
      <p className="mt-3 text-sm text-danger">{error}</p>
    </div>
  );
}
