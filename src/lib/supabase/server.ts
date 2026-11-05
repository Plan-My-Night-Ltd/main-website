import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { authConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

/** Supabase client for server components, route handlers and server actions. Null when not configured. */
export async function serverSupabase(): Promise<SupabaseClient | null> {
  // Read cookies first so every page using this renders per request, configured or not.
  const cookieStore = await cookies();
  if (!authConfigured) return null;
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        // Server components can't set cookies; proxy.ts refreshes the session instead.
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {}
      },
    },
  });
}

/** The signed-in user, verified with Supabase, or null. */
export async function currentUser(): Promise<User | null> {
  const supabase = await serverSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}
