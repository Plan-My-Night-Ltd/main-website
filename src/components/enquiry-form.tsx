"use client";

import { useState, type FormEvent } from "react";
import { button } from "@/components/ui";
import type { Plan } from "@/lib/plan/build";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; email: string } | { kind: "error"; message: string };

const field =
  "mt-1.5 w-full border-0 border-b border-black/25 bg-transparent px-0 py-2 text-black placeholder:text-ash-deep/70 focus:border-black focus:outline-none [color-scheme:light]";

export function EnquiryForm({ plan }: { plan: Plan }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setStatus({ kind: "sending" });
    const body = {
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone") || null,
      partySize: Number(form.get("partySize")),
      notes: form.get("notes") || null,
      nightDate: plan.answers.date,
      plan: {
        answers: plan.answers,
        stops: plan.stops.map((s) => ({ stop: s.stop, venue: s.venue?.slug ?? null, arrive: s.arrive })),
      },
    };
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "We couldn't send your request. Check your details and try again.");
      setStatus({ kind: "sent", email: String(body.email) });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  if (status.kind === "sent") {
    return (
      <div className="mt-8 border-t border-black/15 pt-6" role="status">
        <p className="text-xl font-light">Request sent.</p>
        <p className="mt-1 text-ash-deep">
          We&apos;ll email {status.email} once we&apos;ve heard back from the venues, usually within a day.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-6">
      <label className="block text-sm">
        Your name
        <input name="name" required autoComplete="name" className={field} />
      </label>
      <label className="block text-sm">
        Email
        <input name="email" type="email" required autoComplete="email" className={field} />
      </label>
      <div className="grid grid-cols-[1fr_5rem] gap-6">
        <label className="block text-sm">
          Phone <span className="text-ash-deep">(optional)</span>
          <input name="phone" type="tel" autoComplete="tel" className={field} />
        </label>
        <label className="block text-sm">
          People
          <input
            name="partySize"
            type="number"
            min={1}
            max={50}
            required
            defaultValue={plan.answers.partySize}
            className={field}
          />
        </label>
      </div>
      <label className="block text-sm">
        Anything we should know? <span className="text-ash-deep">(optional)</span>
        <textarea name="notes" rows={3} placeholder="Birthday, dietary needs, arriving late…" className={field} />
      </label>
      {status.kind === "error" && (
        <p className="text-sm text-red-700" role="alert">
          {status.message}
        </p>
      )}
      <button
        type="submit"
        disabled={status.kind === "sending"}
        className={`${button.dark} w-full`}
      >
        {status.kind === "sending" ? "Sending request…" : "Send booking request"}
      </button>
      <p className="text-xs text-ash-deep">We only use your details to arrange this booking.</p>
    </form>
  );
}
