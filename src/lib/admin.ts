// The one account that can open the Control Center. The database checks this too
// (public.is_admin() in supabase/migrations/20261125000100_control_center.sql), so
// changing it means changing both. Here it only decides whether to show the button.
export const adminEmail = "info@planmynights.co.uk";

export function isAdminEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === adminEmail;
}
