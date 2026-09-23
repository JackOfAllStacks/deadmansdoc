"use client";

import { useActionState, useMemo, useState } from "react";
import { confirmPlan, type FormState } from "@/app/(app)/actions";
import { FormError, SubmitButton } from "@/components/form";
import type { Signals } from "@/lib/intake/signals";
import { buildPlan, formatMinutes, isIsoDate, RHYTHMS, totalMinutes, type Rhythm } from "@/lib/plan/build-plan";
import type { SessionTemplate } from "@/lib/plan/template";
import { formatDay } from "@/lib/today";

export function PlanBuilder({
  signals,
  template,
  today,
  latest,
  defaultStart,
}: {
  signals: Signals;
  template: SessionTemplate;
  today: string;
  latest: string;
  defaultStart: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(confirmPlan, {});
  const [startDate, setStartDate] = useState(defaultStart);
  const [rhythm, setRhythm] = useState<Rhythm>("weekly");

  const plan = useMemo(
    () => (isIsoDate(startDate) ? buildPlan(signals, template, { startDate, rhythm }) : null),
    [signals, template, startDate, rhythm],
  );

  return (
    <form action={action} className="flex flex-col gap-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">First sitting</span>
          <input
            type="date"
            name="startDate"
            value={startDate}
            min={today}
            max={latest}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="rounded-md border border-foreground/20 bg-background px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">How often</span>
          <select
            name="rhythm"
            value={rhythm}
            onChange={(e) => setRhythm(e.target.value as Rhythm)}
            className="rounded-md border border-foreground/20 bg-background px-3 py-2"
          >
            {Object.entries(RHYTHMS).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {plan && (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-foreground/70">
            {plan.length} sittings, about {formatMinutes(totalMinutes(plan))} in total.
          </p>
          <ol className="flex flex-col gap-3">
            {plan.map((sitting, i) => (
              <li key={i} className="flex gap-4 rounded-md border border-foreground/15 p-4">
                <span className="w-6 shrink-0 text-right tabular-nums text-foreground/40">{i + 1}</span>
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <span className="font-medium">{sitting.title}</span>
                    <span className="text-sm text-foreground/60">about {formatMinutes(sitting.minutes)}</span>
                  </div>
                  <span className="text-sm text-foreground/70">{sitting.summary}</span>
                  <span className="text-sm">{formatDay(sitting.date)}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <FormError message={state.error ?? null} />
      <SubmitButton pending={pending}>{pending ? "Saving…" : "Use this plan"}</SubmitButton>
    </form>
  );
}
