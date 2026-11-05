"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { authConfigured } from "@/lib/supabase/env";

/**
 * The signed-in user in the browser. `undefined` while checking, `null` when signed out.
 * Checked client-side so static pages (venues, neighbourhoods) stay static.
 */
export function useUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(authConfigured ? undefined : null);

  useEffect(() => {
    const supabase = browserSupabase();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  return user;
}
