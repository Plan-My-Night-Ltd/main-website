import type { Metadata } from "next";
import { Questionnaire, type DateOption } from "@/components/questionnaire";
import { launchAreaSlugs } from "@/lib/data/areas";
import { decodeAnswers, type Answers } from "@/lib/plan/answers";
import { getArea, listAreas } from "@/lib/venues";

export const metadata: Metadata = {
  title: "Plan my night",
  robots: { index: false },
};

// Dates are worked out in London time on the server so "Tonight" is right for the city, not the browser.
function londonToday(): Date {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  return new Date(`${iso}T00:00:00Z`);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dateOptions(): DateOption[] {
  const today = londonToday();
  const addDays = (n: number) => new Date(today.getTime() + n * 86_400_000);
  const dow = today.getUTCDay(); // 0 = Sunday
  const options: DateOption[] = [
    { value: isoDate(today), label: "Tonight" },
    { value: isoDate(addDays(1)), label: "Tomorrow" },
  ];
  for (const [target, name] of [
    [5, "Friday"],
    [6, "Saturday"],
  ] as const) {
    const ahead = (target - dow + 7) % 7;
    if (ahead > 1) options.push({ value: isoDate(addDays(ahead)), label: `This ${name}` });
  }
  return options;
}

export default async function PlanPage(props: PageProps<"/plan">) {
  const params = await props.searchParams;
  const edit = typeof params.edit === "string" ? decodeAnswers(params.edit) : null;
  const areaParam = typeof params.area === "string" && getArea(params.area) ? params.area : undefined;

  const options = dateOptions();
  // "Plan again" from a past night keeps the answers but not the date that's gone.
  const repeat: Partial<Answers> | null = edit && edit.date < options[0].value ? { ...edit, date: undefined } : edit;
  if (repeat && repeat.date === undefined) delete repeat.date;

  const all = listAreas();
  const ordered = [
    ...launchAreaSlugs.map((slug) => getArea(slug)!),
    ...all.filter((a) => !launchAreaSlugs.includes(a.slug)),
  ];

  return (
    <Questionnaire
      dateOptions={options}
      areas={ordered.map(({ slug, name }) => ({ slug, name }))}
      initial={repeat ? { ...repeat, swaps: undefined } : areaParam ? { area: areaParam } : {}}
    />
  );
}
