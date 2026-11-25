"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setBooked, type BookingInput } from "@/app/plan/actions";

// "Mark as booked" next to each recommended venue. Tells us who went where, and
// puts the venue on the person's night in their account. Signed-out friends
// viewing a shared plan are sent to sign in first.
export function BookedToggle({
  booking,
  initialBooked,
  signedIn,
  loginHref,
}: {
  booking: BookingInput;
  initialBooked: boolean;
  signedIn: boolean;
  loginHref: string;
}) {
  const [booked, setBookedState] = useState(initialBooked);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const base =
    "inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-[0.9375rem] tracking-wide transition-colors";

  if (!signedIn) {
    return (
      <Link href={loginHref} className={`${base} border-white/35 text-white hover:border-white`}>
        Mark as booked
      </Link>
    );
  }

  function toggle() {
    const next = !booked;
    setBookedState(next);
    setFailed(false);
    startTransition(async () => {
      const ok = await setBooked(booking, next);
      if (!ok) {
        setBookedState(!next);
        setFailed(true);
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={booked}
        className={`${base} ${booked ? "border-white bg-white/10 text-white" : "border-white/35 text-white hover:border-white"}`}
      >
        {booked ? (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
        {booked ? "Booked" : "Mark as booked"}
      </button>
      {failed && (
        <span className="text-sm text-danger" role="alert">
          Didn&apos;t save. Try again.
        </span>
      )}
    </span>
  );
}
