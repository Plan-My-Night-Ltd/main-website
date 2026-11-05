import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

let client: SupabaseClient | null = null;

/** Browser Supabase client, or null when accounts aren't configured yet. */
export function browserSupabase(): SupabaseClient | null {
  if (!authConfigured) return null;
  client ??= createBrowserClient(supabaseUrl, supabaseAnonKey);
  return client;
}
