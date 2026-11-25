/** /control-center with these query parameters, leaving out the defaults. */
export function ccHref(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (!v || (k === "tab" && v === "overview") || (k === "range" && v === "30")) continue;
    q.set(k, v);
  }
  const s = q.toString();
  return s ? `/control-center?${s}` : "/control-center";
}
