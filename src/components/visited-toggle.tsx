"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { useUser } from "@/lib/supabase/use-user";

// "Been here" marker for a venue. Adds or removes a row in the person's visits.
export function VisitedToggle({ venueSlug, tone = "onBlack" }: { venueSlug: string; tone?: "onBlack" | "onLight" }) {
  const user = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [visited, setVisited] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = browserSupabase();
    if (!user || !supabase) return;
    supabase
      .from("visits")
      .select("id")
      .eq("venue_slug", venueSlug)
      .maybeSingle()
      .then(({ data }) => setVisited(Boolean(data)));
  }, [user, venueSlug]);

  async function toggle() {
    const supabase = browserSupabase();
    if (!user || !supabase) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setBusy(true);
    const { error } = visited
      ? await supabase.from("visits").delete().eq("venue_slug", venueSlug)
      : await supabase.from("visits").insert({ venue_slug: venueSlug });
    if (!error) setVisited(!visited);
    setBusy(false);
  }

  if (user === undefined) return null;
  const muted = tone === "onBlack" ? "text-white/75 hover:text-white" : "text-ash-deep hover:text-black";
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={visited}
      className={`inline-flex items-center gap-2 text-sm transition-colors ${visited ? "" : muted}`}
    >
      <span
        aria-hidden
        className={`size-2.5 rounded-full border ${visited ? "border-current bg-current" : "border-current"}`}
      />
      {visited ? "You've been here" : "Mark as visited"}
    </button>
  );
}
