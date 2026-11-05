import Link from "next/link";
import type { ReactNode } from "react";
import { clock, friendlyTime } from "@/lib/format";
import { stopLabel } from "@/lib/plan/answers";
import type { PlannedStop } from "@/lib/plan/build";
import { getArea } from "@/lib/venues";

// The itinerary as a single hairline: a ring for each stop, a solid line while
// you're there, and a dotted line for the walk to the next one.

type Props = {
  stops: PlannedStop[];
  tone?: "onBlack" | "onLight";
  size?: "compact" | "full";
  renderDetails?: (stop: PlannedStop) => ReactNode;
  renderEmpty?: (stop: PlannedStop) => ReactNode;
};

export function NightLine({ stops, tone = "onBlack", size = "full", renderDetails, renderEmpty }: Props) {
  const compact = size === "compact";
  const c =
    tone === "onBlack"
      ? { line: "bg-white/70", dots: "border-white/40", ring: "border-white bg-black", muted: "text-ash" }
      : { line: "bg-black/70", dots: "border-black/30", ring: "border-black bg-bone", muted: "text-ash-deep" };
  const cols = "grid grid-cols-[4.25rem_1.25rem_1fr] gap-x-3 sm:grid-cols-[5rem_1.25rem_1fr] sm:gap-x-4";

  return (
    <ol>
      {stops.map((s, i) => {
        const isLast = i === stops.length - 1;
        return (
          <li key={s.stop}>
            {s.travel && (
              <div className={cols}>
                <span />
                <span className="flex justify-center">
                  <span
                    className={
                      s.travel.mode === "walk" ? `h-12 w-0 border-l border-dashed ${c.dots}` : `h-12 w-px ${c.line}`
                    }
                  />
                </span>
                <span className={`self-center text-sm ${c.muted}`}>
                  {s.travel.mode === "walk"
                    ? `${s.travel.minutes} minute walk`
                    : `About ${s.travel.minutes} minutes by Tube or taxi`}
                </span>
              </div>
            )}

            <div className={cols}>
              <time className="pt-0.5 text-right text-[0.9375rem] font-light sm:text-base">
                {friendlyTime(clock(s.arrive))}
              </time>

              <span className="flex flex-col items-center">
                <span
                  className={`mt-2 size-3 shrink-0 rounded-full border ${s.venue ? c.ring : `border-dashed ${c.dots}`}`}
                />
                {(!isLast || !compact) && <span className={`w-px flex-1 ${s.venue ? c.line : c.dots}`} />}
              </span>

              <div className={compact ? "pb-1" : "pb-12"}>
                <p className={`text-sm ${c.muted}`}>
                  {stopLabel[s.stop]}
                  {s.venue && s.leave !== undefined && !compact && <> until {friendlyTime(clock(s.leave))}</>}
                </p>

                {s.venue ? (
                  <>
                    <h3 className={`mt-0.5 font-light leading-snug ${compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"}`}>
                      <Link href={`/venues/${s.venue.slug}`} className="underline-offset-[6px] hover:underline">
                        {s.venue.name}
                      </Link>
                    </h3>
                    <p className={`mt-1 text-sm ${c.muted}`}>
                      {getArea(s.venue.areaSlug)?.name}, near {s.venue.nearestTube}
                    </p>
                    {renderDetails?.(s)}
                  </>
                ) : (
                  (renderEmpty?.(s) ?? <p className={`mt-1 ${c.muted}`}>Nothing in our list fits this slot yet.</p>)
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
