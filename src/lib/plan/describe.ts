import { regionLabel } from "@/lib/data/areas";
import { stopLabel, type Answers, type Stop } from "@/lib/plan/answers";
import type { Region } from "@/lib/types";
import { getArea } from "@/lib/venues";

/** "Soho", "Central London" or "London" for an answers.area value. */
export function whereLabel(area: string): string {
  if (area === "anywhere") return "London";
  if (area.startsWith("region:")) return `${regionLabel[area.slice("region:".length) as Region]} London`;
  return getArea(area)?.name ?? "London";
}

/** "Dinner, drinks and dancing" for the stops chosen. */
export function shapeLabel(stops: Stop[]): string {
  const words = stops.map((s, i) => (i === 0 ? stopLabel[s] : stopLabel[s].toLowerCase()));
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}` : (words[0] ?? "");
}

/** Identifies a search regardless of later venue swaps, so swaps update one saved row. */
export function searchKey(a: Answers): string {
  return JSON.stringify({ ...a, swaps: undefined });
}
