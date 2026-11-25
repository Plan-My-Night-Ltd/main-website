"use client";

import { useRef, type ReactNode } from "react";
import type { OutboundClick } from "@/lib/tracking";

// A link out to a venue that tells us it was used. The link itself goes straight
// to the venue as before; the count is sent alongside with sendBeacon, which the
// browser delivers even as the new tab opens. Middle-clicks count too.
export function OutboundLink({
  href,
  click,
  className,
  children,
}: {
  href: string;
  click: OutboundClick;
  className?: string;
  children: ReactNode;
}) {
  const lastSent = useRef(0);

  function send() {
    const now = Date.now();
    if (now - lastSent.current < 1500) return; // a double tap is one visit
    lastSent.current = now;
    try {
      const body = new Blob([JSON.stringify(click)], { type: "application/json" });
      if (!navigator.sendBeacon?.("/api/out", body)) {
        fetch("/api/out", { method: "POST", body, keepalive: true }).catch(() => {});
      }
    } catch {}
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={send}
      onAuxClick={(e) => e.button === 1 && send()}
    >
      {children}
    </a>
  );
}
