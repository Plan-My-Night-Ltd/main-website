"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { signOut } from "@/app/account/actions";
import { isAdminEmail } from "@/lib/admin";
import { useUser } from "@/lib/supabase/use-user";

const providerLabel: Record<string, string> = { google: "Google", apple: "Apple", email: "email" };

function displayName(user: User): string | null {
  const meta = user.user_metadata ?? {};
  const name = (meta.full_name || meta.name || "").trim();
  return name || null;
}

function initials(user: User): string {
  const name = displayName(user);
  if (name) {
    const parts = name.split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }
  return (user.email?.[0] ?? "?").toUpperCase();
}

// Top right of every page. Signed out: a "Sign in" pill. Signed in: the person's
// initials, which open their details and "Log out". A sheet from the bottom on
// phones, a panel under the header on larger screens.
export function AccountMenu() {
  const user = useUser();
  const pathname = usePathname();
  // Remembers the page it was opened on, so moving to another page closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenOn(null);
        trigger.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    // On phones the sheet covers the page, so stop it scrolling underneath.
    const lockScroll = window.matchMedia("(max-width: 639px)").matches;
    const { overflow } = document.body.style;
    if (lockScroll) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  if (user === undefined) return <span className="size-9" aria-hidden />;

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-full border border-white/35 px-4 py-1.5 text-white transition-colors hover:border-white"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Your account"
        className={`flex size-9 items-center justify-center rounded-full border text-[0.8125rem] tracking-wider transition-colors ${
          open ? "border-white bg-white text-black" : "border-white/35 text-white hover:border-white"
        }`}
      >
        {initials(user)}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 sm:bg-transparent" onClick={() => setOpen(false)} aria-hidden />
          <div
            ref={panel}
            id={panelId}
            role="dialog"
            aria-label="Your account"
            tabIndex={-1}
            className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-raised px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-left focus:outline-none motion-safe:animate-[sheet-up_220ms_ease-out] sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:bottom-auto sm:mt-3 sm:w-80 sm:border sm:pt-6 sm:pb-5 sm:motion-safe:animate-[drop-in_160ms_ease-out]"
          >
            <span className="mx-auto mb-5 block h-1 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden />

            <AccountDetails user={user} onNavigate={() => setOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
}

/** "Control Center" in the header, for the admin account only. Everyone else sees nothing. */
export function ControlCenterLink() {
  const user = useUser();
  const pathname = usePathname();
  if (!user || !isAdminEmail(user.email)) return null;
  const here = pathname.startsWith("/control-center");
  return (
    <Link
      href="/control-center"
      aria-current={here ? "page" : undefined}
      className={`hidden rounded-full border px-4 py-1.5 transition-colors sm:inline-flex ${
        here ? "border-white bg-white text-black" : "border-white/35 text-white hover:border-white"
      }`}
    >
      Control Center
    </Link>
  );
}

/** The person's details, links and "Log out", inside the account menu. */
export function AccountDetails({ user, onNavigate }: { user: User; onNavigate: () => void }) {
  const name = displayName(user);
  const provider = providerLabel[user.app_metadata?.provider ?? "email"] ?? "email";
  const since = new Date(user.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <>
      <div className="flex items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-black">
          {initials(user)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-light text-white">{name ?? user.email}</p>
          {name && <p className="truncate text-sm text-ash">{user.email}</p>}
        </div>
      </div>
      <p className="mt-4 text-sm text-ash">
        Signed in with {provider}. Member since {since}.
      </p>

      <nav className="mt-5 border-t border-line">
        {isAdminEmail(user.email) && (
          <MenuLink href="/control-center" onClick={onNavigate}>
            Control Center
          </MenuLink>
        )}
        <MenuLink href="/account" onClick={onNavigate}>
          Your nights
        </MenuLink>
        <MenuLink href="/plan" onClick={onNavigate}>
          Plan a night
        </MenuLink>
        {provider === "email" && (
          <MenuLink href="/account/password" onClick={onNavigate}>
            Change password
          </MenuLink>
        )}
      </nav>

      <form action={signOut} className="mt-6">
        <button
          type="submit"
          className="w-full rounded-full border border-white/35 px-6 py-3 text-[0.9375rem] tracking-wide text-white transition-colors hover:border-white"
        >
          Log out
        </button>
      </form>
    </>
  );
}

function MenuLink({ href, onClick, children }: { href: string; onClick: () => void; children: ReactNode }) {
  return (
    <Link href={href} onClick={onClick} className="flex min-h-12 items-center justify-between border-b border-line text-[0.9375rem] text-white/85 hover:text-white">
      {children}
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="text-ash">
        <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
