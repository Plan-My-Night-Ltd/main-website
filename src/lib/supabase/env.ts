// Public Supabase settings. Until they're set in .env.local, accounts are switched
// off and the site works signed-out.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const authConfigured = Boolean(supabaseUrl && supabaseAnonKey);
