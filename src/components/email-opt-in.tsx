"use client";

import { useState, useTransition } from "react";
import { setMarketingOptIn } from "@/app/account/actions";

// Asked once, after sign-up, on the plan they came for. Never pre-ticked; the
// answer can be changed on the account page.
export function EmailOptIn() {
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(optIn: boolean) {
    setAnswer(optIn);
    startTransition(() => setMarketingOptIn(optIn));
  }

  if (answer !== null) {
    return (
      <p className="text-sm text-white/70" role="status">
        {answer ? "Lovely. We'll be in touch. You can stop the emails any time." : "No problem. You can change this in your account."}
      </p>
    );
  }

  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/70">
      <span>Want our pick of London nights by email?</span>
      <button type="button" disabled={pending} onClick={() => choose(true)} className="text-white underline underline-offset-4">
        Yes, send them
      </button>
      <button type="button" disabled={pending} onClick={() => choose(false)} className="hover:text-white">
        No thanks
      </button>
    </p>
  );
}
