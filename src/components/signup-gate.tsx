"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AuthForm } from "@/components/auth-form";

// The pop-up over a signed-out guest's plan. It can't be closed: the plan behind it
// is only a blurred outline until they create an account or sign in, and then the
// page reloads with the full night. "Change answers" is the way out.
export function SignupGate({ next, summary, editHref }: { next: string; summary: string; editHref: string }) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/55 backdrop-blur-[2px] sm:items-center sm:p-6">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gate-title"
        aria-describedby="gate-summary"
        tabIndex={-1}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto border border-line bg-raised px-6 pt-8 pb-6 focus:outline-none sm:px-10 sm:pt-10 sm:pb-8"
      >
        <p className="text-xs tracking-[0.3em] text-ash">YOUR NIGHT IS READY</p>
        <h2 id="gate-title" className="mt-3 text-title font-light">
          {mode === "signup" ? "Create a free account to see it" : "Sign in to see your night"}
        </h2>
        <p id="gate-summary" className="mt-3 text-ash">
          {summary} We&apos;ll keep it in your account, along with every night you plan after it.
        </p>

        <AuthForm key={mode} mode={mode} next={next} onSwitchMode={setMode} />

        <p className="mt-6 border-t border-line pt-5 text-sm text-ash">
          <Link href={editHref} className="hover:text-white">
            Change answers
          </Link>
        </p>
      </div>
    </div>
  );
}
