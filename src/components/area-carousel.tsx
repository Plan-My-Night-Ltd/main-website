"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Horizontal slider for neighbourhood tiles. Swipe on touch screens, arrows on desktop.
// The track runs to the right edge of the window so the next tile always peeks in.
export function AreaCarousel({ heading, intro, footer, children }: {
  heading: ReactNode;
  intro?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const track = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  function updateEnds() {
    const el = track.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }

  useEffect(() => {
    updateEnds();
    window.addEventListener("resize", updateEnds);
    return () => window.removeEventListener("resize", updateEnds);
  }, []);

  function move(direction: 1 | -1) {
    const el = track.current;
    if (!el) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: reduceMotion ? "auto" : "smooth" });
  }

  const arrow =
    "flex size-11 items-center justify-center rounded-full border border-white/35 transition-colors hover:border-white disabled:opacity-25 disabled:hover:border-white/35";

  return (
    <div>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:flex-row sm:items-end sm:justify-between sm:px-8">
        <div className="max-w-xl">
          {heading}
          {intro}
        </div>
        <div className="hidden gap-2 sm:flex">
          <button type="button" className={arrow} onClick={() => move(-1)} disabled={atStart} aria-label="Previous neighbourhoods">
            <Chevron direction="left" />
          </button>
          <button type="button" className={arrow} onClick={() => move(1)} disabled={atEnd} aria-label="More neighbourhoods">
            <Chevron direction="right" />
          </button>
        </div>
      </div>

      <ul
        ref={track}
        onScroll={updateEnds}
        className="no-scrollbar mt-10 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 scroll-px-4 sm:px-8 sm:scroll-px-8 xl:px-[calc((100vw-80rem)/2+2rem)] xl:scroll-px-[calc((100vw-80rem)/2+2rem)]"
      >
        {children}
      </ul>

      {footer && <div className="mx-auto mt-10 max-w-7xl px-4 sm:px-8">{footer}</div>}
    </div>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d={direction === "left" ? "M10 3 5 8l5 5" : "m6 3 5 5-5 5"}
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
