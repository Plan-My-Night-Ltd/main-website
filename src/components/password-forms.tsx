"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { button } from "@/components/ui";
import { browserSupabase } from "@/lib/supabase/client";

const field =
  "mt-2 w-full border-0 border-b border-white/30 bg-transparent px-0 py-2.5 text-white focus:border-white focus:outline-none";

/** Sends a reset link that signs the person in and lands on /account/password. */
export function RequestResetForm() {
  const supabase = browserSupabase();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    const email = String(new FormData(e.currentTarget).get("email"));
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/account/password`,
    });
    setBusy(false);
    if (error) setError("We couldn't send the email. Wait a minute and try again.");
    else setSentTo(email);
  }

  if (!supabase) return <p className="mt-10 text-ash">Accounts aren&apos;t switched on in this preview yet.</p>;
  if (sentTo) {
    return (
      <p className="mt-10 border-t border-line pt-6 text-ash" role="status">
        If there&apos;s an account for {sentTo}, a reset link is on its way. It works once and expires after an hour.
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="mt-10 space-y-6">
      <label className="block text-sm">
        Email
        <input name="email" type="email" required autoComplete="email" className={field} />
      </label>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={`${button.light} w-full`}>
        {busy ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}

export function NewPasswordForm() {
  const router = useRouter();
  const supabase = browserSupabase();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    const password = String(new FormData(e.currentTarget).get("password"));
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError("Use a password of at least 8 characters that you haven't used here before.");
      setBusy(false);
      return;
    }
    router.push("/account");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-10 space-y-6">
      <label className="block text-sm">
        New password
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={field} />
      </label>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={`${button.light} w-full`}>
        {busy ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
