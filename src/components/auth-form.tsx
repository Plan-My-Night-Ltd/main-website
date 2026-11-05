"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { button } from "@/components/ui";
import { browserSupabase } from "@/lib/supabase/client";

type Mode = "login" | "signup";

const field =
  "mt-2 w-full border-0 border-b border-white/30 bg-transparent px-0 py-2.5 text-white placeholder:text-ash focus:border-white focus:outline-none";

export function AuthForm({ mode, next, linkError }: { mode: Mode; next: string; linkError?: boolean }) {
  const router = useRouter();
  const supabase = browserSupabase();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    linkError ? "That link has expired or was already used. Sign in again, or request a new link." : null,
  );
  const [checkEmail, setCheckEmail] = useState<string | null>(null);

  const callback = (path: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(path)}`;

  const notConnected = "Accounts aren't switched on in this preview yet. They'll work once Supabase is connected.";

  async function withGoogle() {
    if (!supabase) return setError(notConnected);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback(next) },
    });
    if (error) {
      setError("Google sign-in didn't start. Try again in a moment.");
      setBusy(false);
    }
  }

  async function withEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return setError(notConnected);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    setBusy(true);
    setError(null);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(
          error.message.toLowerCase().includes("confirm")
            ? "Confirm your email first. We sent you a link when you signed up."
            : "That email and password don't match. Check them, or reset your password.",
        );
        setBusy(false);
        return;
      }
      router.push(next);
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: callback(next), data: { full_name: String(form.get("name") || "") || undefined } },
    });
    if (error) {
      setError(
        error.message.toLowerCase().includes("password")
          ? "Use a password of at least 8 characters."
          : "We couldn't create your account. If you already have one, sign in instead.",
      );
      setBusy(false);
      return;
    }
    if (data.session) {
      router.push(next);
      router.refresh();
    } else {
      setCheckEmail(email);
      setBusy(false);
    }
  }

  if (checkEmail) {
    return (
      <div className="mt-10 border-t border-line pt-6" role="status">
        <p className="text-xl font-light">Check your email.</p>
        <p className="mt-2 text-ash">
          We sent a link to {checkEmail}. Open it on this device to confirm your account and sign in.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <button type="button" onClick={withGoogle} disabled={busy} className={`${button.light} w-full gap-3`}>
        <GoogleMark />
        Continue with Google
      </button>

      <div className="my-8 flex items-center gap-4 text-sm text-ash">
        <span className="h-px flex-1 bg-line" />
        or with email
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={withEmail} className="space-y-6">
        {mode === "signup" && (
          <label className="block text-sm">
            Your name <span className="text-ash">(optional)</span>
            <input name="name" autoComplete="name" className={field} />
          </label>
        )}
        <label className="block text-sm">
          Email
          <input name="email" type="email" required autoComplete="email" className={field} />
        </label>
        <label className="block text-sm">
          <span className="flex justify-between">
            Password
            {mode === "login" && (
              <Link href="/forgot-password" className="text-ash hover:text-white">
                Forgot password?
              </Link>
            )}
          </span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className={field}
          />
        </label>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={`${button.ghost} w-full`}>
          {busy ? "One moment…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="mt-8 text-sm text-ash">
        {mode === "login" ? "New here? " : "Already have an account? "}
        <Link
          href={`${mode === "login" ? "/signup" : "/login"}?next=${encodeURIComponent(next)}`}
          className="text-white underline underline-offset-4"
        >
          {mode === "login" ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </div>
  );
}

// Google's "G" mark, kept in its brand colours as Google's sign-in guidelines require.
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
