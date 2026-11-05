import { regionLabel } from "@/lib/data/areas";
import { nightShapes, type Answers, type Stop } from "@/lib/plan/answers";
import type { Region } from "@/lib/types";
import { getArea } from "@/lib/venues";

/** "Soho", "Central London" or "London" for an answers.area value. */
export function whereLabel(area: string): string {
  if (area === "anywhere") return "London";
  if (area.startsWith("region:")) return `${regionLabel[area.slice("region:".length) as Region]} London`;
  return getArea(area)?.name ?? "London";
}

/** "Dinner, drinks, then dancing" for the stops chosen. */
export function shapeLabel(stops: Stop[]): string {
  return nightShapes.find((n) => n.stops.join() === stops.join())?.hint ?? stops.join(", ");
}

/** Identifies a search regardless of later venue swaps, so swaps update one saved row. */
export function searchKey(a: Answers): string {
  return JSON.stringify({ ...a, swaps: undefined });
}
