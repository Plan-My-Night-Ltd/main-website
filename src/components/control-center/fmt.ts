// Number and date formatting for the Control Center. No app imports, so browser components can use it.

const tz = "Europe/London";

/** "25 Nov 2026" from a timestamp or a YYYY-MM-DD date. */
export function day(value: string | null | undefined): string {
  if (!value) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: tz });
}

/** "25 Nov, 21:04". */
export function dayTime(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  });
}

export function num(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("en-GB");
}

/** "42%" of a whole, or an en dash when there's nothing to divide by. */
export function pct(part: number, whole: number): string {
  if (!whole) return "–";
  const p = (part / whole) * 100;
  return `${p >= 10 || p === 0 ? Math.round(p) : p.toFixed(1)}%`;
}
