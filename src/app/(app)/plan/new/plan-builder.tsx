"use client";

import { useActionState, useMemo, useState } from "react";
import { confirmPlan, type FormState } from "@/app/(app)/actions";
import { Field, FormError, Select, SubmitButton } from "@/components/form";
import { TopicChips } from "@/components/topics";
import { Card, Note } from "@/components/ui";
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
  const topicsFor = (key: string) => template.sittings.find((s) => s.key === key)?.topics ?? [];

  return (
    <form action={action} className="flex flex-col gap-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="First sitting"
          type="date"
          name="startDate"
          value={startDate}
          min={today}
          max={latest}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />
        <Select label="How often" name="rhythm" value={rhythm} onChange={(e) => setRhythm(e.target.value as Rhythm)}>
          {Object.entries(RHYTHMS).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {plan && (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            {plan.length} sittings, about {formatMinutes(totalMinutes(plan))} in total.
          </p>
          <ol className="flex flex-col gap-3">
            {plan.map((sitting, i) => (
              <li key={i}>
                <Card className="flex gap-4">
                  <span className="w-6 shrink-0 text-right tabular-nums text-faint">{i + 1}</span>
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                      <h2 className="text-lg">{sitting.title}</h2>
                      <span className="text-sm text-muted">about {formatMinutes(sitting.minutes)}</span>
                    </div>
                    <p className="text-sm text-muted">{sitting.summary}</p>
                    <TopicChips topics={topicsFor(sitting.key)} />
                    <p className="text-sm">{formatDay(sitting.date)}</p>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        </section>
      )}

      <Note>
        These dates are only a rhythm to aim at. Any sitting can be moved, or started early, from
        the plan afterwards.
      </Note>

      <FormError message={state.error ?? null} />
      <SubmitButton pending={pending}>{pending ? "Saving…" : "Use this plan"}</SubmitButton>
    </form>
  );
}
