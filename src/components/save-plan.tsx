"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Answers } from "@/lib/plan/answers";
import { browserSupabase } from "@/lib/supabase/client";
import { useUser } from "@/lib/supabase/use-user";

// Saves the plan to the signed-in person's history (one row per search; swaps
// update it). Signed-out guests get a prompt to sign in and keep it.
export function SavePlan({ planKey, searchKey, answers }: { planKey: string; searchKey: string; answers: Answers }) {
  const user = useUser();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const supabase = browserSupabase();
    if (!user || !supabase) return;
    supabase
      .from("saved_plans")
      .upsert(
        {
          user_id: user.id,
          search_key: searchKey,
          plan_key: planKey,
          answers,
          night_date: answers.date,
          area: answers.area,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,search_key" },
      )
      .then(({ error }) => setSaved(!error));
  }, [user, planKey, searchKey, answers]);

  if (user === undefined) return null;
  if (!user) {
    return (
      <p className="text-sm text-white/70">
        <Link
          href={`/login?next=${encodeURIComponent(`/plan/${planKey}`)}`}
          className="text-white underline underline-offset-4"
        >
          Sign in
        </Link>{" "}
        to keep this night in your account.
      </p>
    );
  }
  return saved ? (
    <p className="text-sm text-white/70">
      Saved to{" "}
      <Link href="/account" className="text-white underline underline-offset-4">
        your account
      </Link>
      .
    </p>
  ) : null;
}
