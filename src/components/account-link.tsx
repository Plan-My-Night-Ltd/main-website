"use client";

import Link from "next/link";
import { useUser } from "@/lib/supabase/use-user";

export function AccountLink() {
  const user = useUser();
  const signedIn = Boolean(user);
  return (
    <Link
      href={signedIn ? "/account" : "/login"}
      className="rounded-full border border-white/35 px-4 py-1.5 text-white transition-colors hover:border-white"
    >
      {signedIn ? "Account" : "Sign in"}
    </Link>
  );
}
