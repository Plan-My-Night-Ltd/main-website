import type { SupabaseClient } from "@supabase/supabase-js";
import { call, type AdminUser } from "@/app/control-center/data";
import { day, label, num, pct } from "@/components/control-center/labels";
import { PeopleView, type PersonRow } from "@/components/control-center/people-view";
import { SetupNotice, Stat, StatGrid } from "@/components/control-center/ui";

// Everyone who signed up. The rows are labelled here on the server and handed to
// PeopleView, which filters, sorts and searches them in the browser.
export async function PeopleTab({ supabase }: { supabase: SupabaseClient }) {
  const res = await call<AdminUser[]>(supabase, "admin_users");
  if (res.error !== null) return <SetupNotice error={res.error} />;
  const users = res.data;

  const searched = users.filter((u) => u.searches > 0).length;
  const returning = users.filter((u) => u.returned).length;
  const rows: PersonRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    signedUpAt: u.signed_up_at,
    signedUp: day(u.signed_up_at),
    provider: label.provider(u.provider),
    searches: u.searches,
    nights: u.nights_planned,
    days: u.days_active,
    returned: u.returned,
    clicks: u.clicks,
    bookings: u.bookings,
    lastActiveOn: u.last_active_on,
    lastActive: day(u.last_active_on),
    usually:
      u.searches > 0
        ? [
            label.area(u.usual_area),
            label.budgetShort(u.usual_budget),
            u.usual_group && label.group(u.usual_group).toLowerCase(),
            u.avg_party_size && `avg. ${u.avg_party_size} people`,
          ]
            .filter(Boolean)
            .join(", ")
        : "",
    optIn: u.marketing_opt_in,
  }));

  return (
    <div className="space-y-8">
      <StatGrid>
        <Stat label="Accounts" value={num(users.length)} note={`${num(users.filter((u) => !u.confirmed).length)} haven't confirmed their email`} />
        <Stat label="Have searched" value={num(searched)} note={`${pct(searched, users.length)} of accounts`} />
        <Stat label="Returning" value={num(returning)} note={`${pct(returning, searched)} of people who searched`} />
        <Stat label="Said yes to emails" value={num(users.filter((u) => u.marketing_opt_in).length)} />
      </StatGrid>
      <PeopleView rows={rows} />
    </div>
  );
}
