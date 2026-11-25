import { call, sessionEmail, type AdminUser, type Bookings } from "@/app/control-center/data";
import { label } from "@/components/control-center/labels";
import { isAdminEmail } from "@/lib/admin";
import { serverSupabase } from "@/lib/supabase/server";

// CSV downloads for the Control Center: ?type=people, mailing-list or bookings.
// Anyone but the admin gets a 404, same as the pages.

function csv(rows: (string | number | boolean | null | undefined)[][]): string {
  const cell = (v: string | number | boolean | null | undefined) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheets running it as a formula
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export async function GET(request: Request) {
  const supabase = await serverSupabase();
  if (!supabase || !isAdminEmail(await sessionEmail(supabase))) return new Response("Not found", { status: 404 });

  const type = new URL(request.url).searchParams.get("type");
  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  let rows: (string | number | boolean | null | undefined)[][];

  if (type === "people" || type === "mailing-list") {
    const res = await call<AdminUser[]>(supabase, "admin_users");
    if (res.error !== null) return new Response(res.error, { status: 500 });
    const data = res.data;
    if (type === "mailing-list") {
      rows = [["Name", "Email", "Signed up"], ...data.filter((u) => u.marketing_opt_in).map((u) => [u.name, u.email, u.signed_up_at])];
    } else {
      rows = [
        ["Name", "Email", "Signed up with", "Signed up", "Last sign-in", "Email confirmed", "Emails opt-in", "Searches", "Nights planned", "Days active", "Returning", "Last active", "Clicks", "Bookings", "Usual area", "Usual budget", "Usual group", "Average party size"],
        ...data.map((u) => [
          u.name, u.email, label.provider(u.provider), u.signed_up_at, u.last_sign_in_at, u.confirmed,
          u.marketing_opt_in === null ? "not asked" : u.marketing_opt_in, u.searches, u.nights_planned, u.days_active, u.returned,
          u.last_active_on, u.clicks, u.bookings, label.area(u.usual_area), label.budgetShort(u.usual_budget),
          u.usual_group ? label.group(u.usual_group) : "", u.avg_party_size,
        ]),
      ];
    }
  } else if (type === "bookings") {
    const res = await call<Bookings>(supabase, "admin_bookings", { p_since: null });
    if (res.error !== null) return new Response(res.error, { status: 500 });
    const data = res.data;
    rows = [
      ["Marked at", "Night", "Name", "Email", "Venue", "Venue type", "Area", "Stop", "Party size", "Books through", "Clicked through first", "Who", "Budget", "Vibes"],
      ...data.list.map((b) => [
        b.created_at, b.night_date, b.name, b.email, b.venue ?? b.venue_slug, label.venueType(b.venue_type), label.area(b.area),
        label.stop(b.stop), b.party_size, b.platform ? label.platform(b.platform) : "", b.after_click,
        b.answers ? label.group(b.answers.group) : "", b.answers ? label.budgetShort(b.answers.budget) : "",
        b.answers?.vibes?.map(label.vibe).join("; ") ?? "",
      ]),
    ];
  } else {
    return new Response("Unknown export", { status: 400 });
  }

  return new Response(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="planmynights-${type}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
