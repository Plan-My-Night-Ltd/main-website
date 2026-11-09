import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { removeSavedPlan, signOut } from "@/app/account/actions";
import { button } from "@/components/ui";
import { longDate, venueTypeLabel } from "@/lib/format";
import type { Answers } from "@/lib/plan/answers";
import { shapeLabel, whereLabel } from "@/lib/plan/describe";
import { serverSupabase } from "@/lib/supabase/server";
import { getArea, getVenuesBySlugs } from "@/lib/venues";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false },
};

type SavedPlan = { id: string; plan_key: string; answers: Answers; night_date: string; area: string; updated_at: string };
type Visit = { venue_slug: string; visited_on: string };

function londonToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
}

export default async function AccountPage() {
  const supabase = await serverSupabase();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) redirect("/login?next=/account");

  const [{ data: profile }, { data: plans }, { data: visits }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("saved_plans")
      .select("id, plan_key, answers, night_date, area, updated_at")
      .order("night_date", { ascending: false })
      .limit(50)
      .returns<SavedPlan[]>(),
    supabase.from("visits").select("venue_slug, visited_on").order("visited_on", { ascending: false }).returns<Visit[]>(),
  ]);

  const visitedVenues = new Map((await getVenuesBySlugs((visits ?? []).map((v) => v.venue_slug))).map((v) => [v.slug, v]));
  const today = londonToday();
  const upcoming = (plans ?? []).filter((p) => p.night_date >= today).reverse();
  const past = (plans ?? []).filter((p) => p.night_date < today);
  const name = profile?.display_name || user.email;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-16 sm:px-8 sm:pt-24">
      <header className="flex flex-col gap-6 border-b border-line pb-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-display font-light">Your account</h1>
          <p className="mt-3 text-ash">Signed in as {name}</p>
        </div>
        <form action={signOut}>
          <button type="submit" className={button.ghost}>
            Sign out
          </button>
        </form>
      </header>

      <section aria-labelledby="nights" className="mt-16">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="nights" className="text-title font-light">
            Your nights
          </h2>
          <Link href="/plan" className="text-sm text-white/75 underline underline-offset-8 hover:text-white">
            Plan another
          </Link>
        </div>

        {upcoming.length + past.length === 0 ? (
          <p className="mt-8 max-w-md text-ash">
            Nights you plan while signed in are saved here, including any venues you swap.
          </p>
        ) : (
          <>
            {upcoming.length > 0 && <PlanList heading="Coming up" plans={upcoming} />}
            {past.length > 0 && <PlanList heading="Past nights" plans={past} />}
          </>
        )}
      </section>

      <section aria-labelledby="visited" className="mt-24">
        <h2 id="visited" className="text-title font-light">
          Places you&apos;ve been
        </h2>
        {(visits ?? []).length === 0 ? (
          <p className="mt-8 max-w-md text-ash">
            Mark a venue as visited from its page or from your plan, and it will appear here.
          </p>
        ) : (
          <ul className="mt-8 divide-y divide-line border-y border-line">
            {visits!.map((v) => {
              const venue = visitedVenues.get(v.venue_slug);
              return (
                <li key={v.venue_slug}>
                  <Link
                    href={`/venues/${v.venue_slug}`}
                    className="group grid gap-1 py-5 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-6"
                  >
                    <span>
                      <span className="text-xl font-light underline-offset-[6px] group-hover:underline">
                        {venue?.name ?? v.venue_slug}
                      </span>
                      {venue && (
                        <span className="mt-0.5 block text-sm text-ash">
                          {venueTypeLabel[venue.type]}, {getArea(venue.areaSlug)?.name}
                        </span>
                      )}
                    </span>
                    <span className="text-sm text-ash">{longDate(v.visited_on)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function PlanList({ heading, plans }: { heading: string; plans: SavedPlan[] }) {
  return (
    <div className="mt-10">
      <h3 className="text-sm text-ash">{heading}</h3>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {plans.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-6">
            <Link href={`/plan/${p.plan_key}`} className="group block flex-1 py-5">
              <span className="text-xl font-light underline-offset-[6px] group-hover:underline">
                {longDate(p.night_date)} in {whereLabel(p.area)}
              </span>
              <span className="mt-0.5 block text-sm text-ash">
                {shapeLabel(p.answers.stops)}, {p.answers.partySize}{" "}
                {p.answers.partySize === 1 ? "person" : "people"}
              </span>
            </Link>
            <form action={removeSavedPlan}>
              <input type="hidden" name="id" value={p.id} />
              <button type="submit" className="py-2 text-sm text-ash hover:text-white">
                Remove
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
