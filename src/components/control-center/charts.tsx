import { num, pct } from "@/components/control-center/fmt";

// Part-to-whole and per-category charts for the Control Center.
//
// Colours are validated against the panel colour (#121212) with the dataviz
// palette checker: the categorical set passes contrast, lightness, and
// colour-blind separation for neighbouring blocks; the ordinal ramp is one blue
// hue, darkest (closest to the panel) for the smallest category.

const categorical = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c"];
const ordinal = ["#184f95", "#256abf", "#3987e5", "#6da7ec", "#b7d3f6"];
const other = "#6b6b6b";

function ordinalSteps(n: number): string[] {
  if (n >= 5) return ordinal;
  if (n === 4) return [ordinal[0], ordinal[1], ordinal[3], ordinal[4]];
  if (n === 3) return [ordinal[0], ordinal[2], ordinal[4]];
  return [ordinal[1], ordinal[3]].slice(0, n);
}

/** Black or white, whichever reads better on this colour. */
function inkFor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (lum + 0.05) / 0.05 > 1.05 / (lum + 0.05) ? "#000" : "#fff";
}

export type Part = { key: string; label: string; n: number };

/**
 * One whole split into its parts: a tall bar of coloured blocks with each share
 * printed on it where it fits, and a legend that doubles as the table of values.
 * `kind="ordinal"` for answers with a natural order (budget, group size), which
 * keep their order and shade one hue; otherwise the biggest part comes first and
 * anything past six folds into "Other".
 */
export function SegmentedBar({ parts, kind = "categorical", label }: { parts: Part[]; kind?: "categorical" | "ordinal"; label: string }) {
  const total = parts.reduce((s, p) => s + p.n, 0);
  if (total === 0) return <p className="text-sm text-ash">Nothing yet.</p>;

  let shown = parts.filter((p) => p.n > 0);
  if (kind === "categorical") {
    shown = [...shown].sort((a, b) => b.n - a.n);
    if (shown.length > 6) {
      const rest = shown.slice(5).reduce((s, p) => s + p.n, 0);
      shown = [...shown.slice(0, 5), { key: "__other", label: "Other", n: rest }];
    }
  }
  const steps = kind === "ordinal" ? ordinalSteps(shown.length) : categorical;
  const colour = (p: Part, i: number) => (p.key === "__other" ? other : steps[i % steps.length]);

  return (
    <figure>
      <div className="flex h-11 gap-[2px]" role="img" aria-label={`${label}: ${shown.map((p) => `${p.label} ${pct(p.n, total)}`).join(", ")}`}>
        {shown.map((p, i) => {
          const share = p.n / total;
          const bg = colour(p, i);
          return (
            <div
              key={p.key}
              className="group relative flex min-w-[3px] items-center justify-center first:rounded-l-[4px] last:rounded-r-[4px]"
              style={{ flexGrow: p.n, flexBasis: 0, background: bg, color: inkFor(bg) }}
            >
              {share >= 0.09 && <span className="text-xs font-medium tabular-nums">{pct(p.n, total)}</span>}
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded border border-line bg-black px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block">
                {p.label}: {num(p.n)} ({pct(p.n, total)})
              </span>
            </div>
          );
        })}
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {shown.map((p, i) => (
          <li key={p.key} className="flex items-center gap-2.5">
            <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: colour(p, i) }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-white/85">{p.label}</span>
            <span className="tabular-nums text-white">{num(p.n)}</span>
            <span className="w-11 text-right tabular-nums text-ash">{pct(p.n, total)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** One column per category in a fixed order (days of the week, hours). Hover shows the value. */
export function ColumnChart({ points, label }: { points: { key: string; label: string; short: string; n: number }[]; label: string }) {
  const max = Math.max(...points.map((p) => p.n), 0);
  const total = points.reduce((s, p) => s + p.n, 0);
  const peak = points.find((p) => p.n === max && max > 0);
  return (
    <figure>
      <div className="relative h-36 border-b border-white/30">
        <ol className="absolute inset-0 flex items-end gap-[2px]" aria-label={label}>
          {points.map((p) => (
            <li key={p.key} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end" tabIndex={0}>
              {p === peak && <span className="mb-1 text-xs tabular-nums text-white">{num(p.n)}</span>}
              <span
                className={`block w-full max-w-12 rounded-t-[4px] transition-colors group-hover:bg-white group-focus:bg-white ${p === peak ? "bg-white" : "bg-white/55"}`}
                style={{ height: max ? `calc((100% - 1.25rem) * ${p.n / max})` : 0 }}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded border border-line bg-black px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block group-focus:block">
                {p.label}: {num(p.n)} ({pct(p.n, total)})
              </span>
              <span className="sr-only">
                {p.label}: {p.n}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="mt-1.5 flex gap-[2px] text-center text-xs text-ash" aria-hidden>
        {points.map((p) => (
          <span key={p.key} className="min-w-0 flex-1 truncate">
            {p.short}
          </span>
        ))}
      </div>
    </figure>
  );
}
