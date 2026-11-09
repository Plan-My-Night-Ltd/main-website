import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { authConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

let client: SupabaseClient | null = null;

/** Cookie-free client for public data like venues, so pages using it can still be cached. Null when not configured. */
export function publicSupabase(): SupabaseClient | null {
  if (!authConfigured) return null;
  client ??= createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
