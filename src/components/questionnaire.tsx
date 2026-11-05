"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { button } from "@/components/ui";
import {
  budgetOptions,
  encodeAnswers,
  groupOptions,
  musicOptions,
  nightShapes,
  vibeOptions,
  type Answers,
} from "@/lib/plan/answers";

export type DateOption = { value: string; label: string };
type AreaOption = { slug: string; name: string };

type Props = {
  dateOptions: DateOption[];
  areas: AreaOption[]; // launch areas first
  initial: Partial<Answers>;
};

type StepId = "when" | "shape" | "who" | "where" | "budget" | "vibe" | "music";

const startTimes = ["18:00", "19:00", "19:30", "20:00", "21:00", "22:00"];
const maxVibes = 3;

export function Questionnaire({ dateOptions, areas, initial }: Props) {
  const router = useRouter();
  const [a, setA] = useState<Partial<Answers>>({
    date: dateOptions[0].value,
    start: "19:30",
    partySize: 2,
    vibes: [],
    ...initial,
  });
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const needsMusic = !a.stops || a.stops.some((s) => s !== "dinner");
  const steps: StepId[] = ["when", "shape", "who", "where", "budget", "vibe", ...(needsMusic ? (["music"] as const) : [])];
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const isLast = stepIndex >= steps.length - 1;

  function update(patch: Partial<Answers>) {
    setA((prev) => ({ ...prev, ...patch }));
  }

  function next(patch: Partial<Answers> = {}) {
    const merged = { ...a, ...patch };
    setA(merged);
    const musicNeeded = merged.stops?.some((s) => s !== "dinner") ?? true;
    const total = 6 + (musicNeeded ? 1 : 0);
    if (stepIndex + 1 >= total) finish(merged);
    else {
      setStepIndex(stepIndex + 1);
      window.scrollTo({ top: 0 });
    }
  }

  function finish(final: Partial<Answers>) {
    setSubmitting(true);
    const answers: Answers = {
      date: final.date!,
      start: final.start!,
      stops: final.stops!,
      group: final.group!,
      partySize: final.partySize ?? 2,
      area: final.area ?? "anywhere",
      budget: final.budget!,
      vibes: final.vibes ?? [],
      music: final.music ?? "any",
    };
    router.push(`/plan/${encodeAnswers(answers)}`);
  }

  const canContinue: Record<StepId, boolean> = {
    when: Boolean(a.date && a.start),
    shape: Boolean(a.stops),
    who: Boolean(a.group),
    where: Boolean(a.area),
    budget: Boolean(a.budget),
    vibe: true,
    music: Boolean(a.music),
  };

  return (
    <div className={`mx-auto px-4 pt-10 pb-20 sm:px-8 sm:pt-14 ${step === "where" ? "max-w-6xl" : "max-w-2xl"}`}>
      <div className="flex items-center justify-between text-sm text-ash">
        <button
          type="button"
          onClick={() => setStepIndex(Math.max(0, stepIndex - 1))}
          className={`py-2 hover:text-white ${stepIndex === 0 ? "invisible" : ""}`}
        >
          Back
        </button>
        <span>
          {stepIndex + 1} of {steps.length}
        </span>
      </div>
      <div
        className="mt-2 h-px bg-line"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={stepIndex + 1}
        aria-label="Progress"
      >
        <div
          className="h-full bg-white transition-[width] duration-500"
          style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
        />
      </div>

      <div className="mt-12 sm:mt-16" key={step}>
        {step === "when" && (
          <Question title="Which night?">
            <Choices>
              {dateOptions.map((d) => (
                <Chip key={d.value} selected={a.date === d.value} onClick={() => update({ date: d.value })}>
                  {d.label}
                </Chip>
              ))}
            </Choices>
            <label className="mt-5 flex items-center gap-3 text-sm text-ash">
              Or pick a date
              <input
                type="date"
                min={dateOptions[0].value}
                value={a.date}
                onChange={(e) => e.target.value && update({ date: e.target.value })}
                className="border-0 border-b border-white/30 bg-transparent px-0 py-1.5 text-white focus:border-white focus:outline-none"
              />
            </label>
            <h3 className="mt-12 text-xl font-light">What time would you like to start?</h3>
            <div className="mt-5">
              <Choices>
                {startTimes.map((t) => (
                  <Chip key={t} selected={a.start === t} onClick={() => update({ start: t })}>
                    {formatStart(t)}
                  </Chip>
                ))}
              </Choices>
            </div>
          </Question>
        )}

        {step === "shape" && (
          <Question title="What kind of night?">
            <Options>
              {nightShapes.map((n) => (
                <Option
                  key={n.label}
                  label={n.label}
                  hint={n.hint}
                  selected={a.stops?.join() === n.stops.join()}
                  onClick={() => next({ stops: n.stops })}
                />
              ))}
            </Options>
          </Question>
        )}

        {step === "who" && (
          <Question title="Who's coming?">
            <Options>
              {groupOptions.map((g) => (
                <Option
                  key={g.value}
                  label={g.label}
                  hint={g.hint}
                  selected={a.group === g.value}
                  onClick={() =>
                    update({
                      group: g.value,
                      partySize: g.value === "solo" ? 1 : g.value === "date" ? 2 : Math.max(a.partySize ?? 2, 2),
                    })
                  }
                />
              ))}
            </Options>
            {a.group && a.group !== "solo" && a.group !== "date" && (
              <div className="mt-10 flex items-center gap-6">
                <span className="text-xl font-light">How many of you?</span>
                <Stepper value={a.partySize ?? 2} onChange={(n) => update({ partySize: n })} />
              </div>
            )}
          </Question>
        )}

        {step === "where" && (
          <Question title="Where in London?" hint="We'll keep every stop within walking distance where we can.">
            <div className="grid gap-px border-y border-line bg-line sm:grid-cols-2">
              <Option
                label="Anywhere central"
                hint="Soho, Mayfair, Covent Garden and around"
                selected={a.area === "region:central"}
                onClick={() => next({ area: "region:central" })}
              />
              <Option
                label="Wherever's best"
                hint="We'll choose the neighbourhood that suits you"
                selected={a.area === "anywhere"}
                onClick={() => next({ area: "anywhere" })}
              />
            </div>
            <p className="mt-10 mb-4 text-sm text-ash">Or choose a neighbourhood</p>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {areas.map((ar) => (
                <li key={ar.slug}>
                  <AreaChoice area={ar} selected={a.area === ar.slug} onClick={() => next({ area: ar.slug })} />
                </li>
              ))}
            </ul>
          </Question>
        )}

        {step === "budget" && (
          <Question title="What would you like to spend?" hint="Per person, at each stop.">
            <Options>
              {budgetOptions.map((b) => (
                <Option
                  key={b.value}
                  label={b.label}
                  hint={b.hint}
                  selected={a.budget === b.value}
                  onClick={() => next({ budget: b.value })}
                />
              ))}
            </Options>
          </Question>
        )}

        {step === "vibe" && (
          <Question title="How should it feel?" hint={`Choose up to ${maxVibes}, or skip.`}>
            <Choices>
              {vibeOptions.map((v) => {
                const selected = a.vibes?.includes(v.value) ?? false;
                const full = (a.vibes?.length ?? 0) >= maxVibes;
                return (
                  <Chip
                    key={v.value}
                    selected={selected}
                    disabled={!selected && full}
                    onClick={() =>
                      update({
                        vibes: selected ? a.vibes!.filter((x) => x !== v.value) : [...(a.vibes ?? []), v.value],
                      })
                    }
                  >
                    {v.label}
                  </Chip>
                );
              })}
            </Choices>
          </Question>
        )}

        {step === "music" && (
          <Question title="What would you like to hear?">
            <Options>
              {musicOptions.map((m) => (
                <Option key={m.value} label={m.label} selected={a.music === m.value} onClick={() => next({ music: m.value })} />
              ))}
            </Options>
          </Question>
        )}
      </div>

      {(step === "when" || step === "who" || step === "vibe" || isLast) && (
        <div className="mt-14">
          <button
            type="button"
            disabled={!canContinue[step] || submitting}
            onClick={() => (isLast ? finish(a) : next())}
            className={`${button.light} w-full sm:w-auto sm:min-w-48`}
          >
            {submitting ? "Planning your night…" : isLast ? "Show my night" : step === "vibe" && !a.vibes?.length ? "Skip" : "Continue"}
          </button>
        </div>
      )}
    </div>
  );
}

function formatStart(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h > 12 ? h - 12 : h}${m ? `.${String(m).padStart(2, "0")}` : ""}pm`;
}

function Question({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="text-title font-light">{title}</legend>
      {hint && <p className="mt-3 text-ash">{hint}</p>}
      <div className="mt-10">{children}</div>
    </fieldset>
  );
}

function Options({ children }: { children: ReactNode }) {
  return <div className="grid gap-px border-y border-line bg-line">{children}</div>;
}

function Option({ label, hint, selected, onClick }: { label: string; hint?: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex items-center justify-between gap-4 px-4 py-5 text-left transition-colors ${
        selected ? "bg-white text-black" : "bg-black hover:bg-raised"
      }`}
    >
      <span>
        <span className="block text-xl font-light">{label}</span>
        {hint && <span className={`mt-0.5 block text-sm ${selected ? "text-ash-deep" : "text-ash"}`}>{hint}</span>}
      </span>
      <span
        aria-hidden
        className={`size-3 shrink-0 rounded-full border ${selected ? "border-black bg-black" : "border-white/40"}`}
      />
    </button>
  );
}

function AreaChoice({ area, selected, onClick }: { area: AreaOption; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`group relative block aspect-[4/3] w-full overflow-hidden text-left outline-offset-2 ${
        selected ? "outline outline-1 outline-white" : ""
      }`}
    >
      <Image
        src={`/images/${area.slug}.jpg`}
        alt=""
        fill
        sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
        className="photo object-cover transition-transform duration-700 group-hover:scale-[1.04]"
      />
      <span className={`absolute inset-0 ${selected ? "bg-black/20" : "bg-gradient-to-t from-black/85 to-black/10"}`} />
      <span className="absolute inset-x-0 bottom-0 p-3 text-[0.9375rem] sm:text-base">{area.name}</span>
    </button>
  );
}

function Choices({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2.5">{children}</div>;
}

function Chip({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-5 py-2.5 transition-colors disabled:opacity-30 ${
        selected ? "border-white bg-white text-black" : "border-white/30 hover:border-white"
      }`}
    >
      {children}
    </button>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const btn = "size-11 rounded-full border border-white/30 text-xl font-light hover:border-white disabled:opacity-30";
  return (
    <div className="flex items-center gap-4">
      <button type="button" className={btn} aria-label="Fewer people" disabled={value <= 2} onClick={() => onChange(value - 1)}>
        −
      </button>
      <span className="w-8 text-center text-2xl font-light tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} aria-label="More people" disabled={value >= 30} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}
