"use client";

import { useActionState, useMemo } from "react";
import { confirmPlan, type FormState } from "@/app/(app)/actions";
import { FormError, SubmitButton } from "@/components/form";
import { TopicChips } from "@/components/topics";
import { Card, Note } from "@/components/ui";
import type { Signals } from "@/lib/intake/signals";
import { buildPlan, formatMinutes, totalMinutes } from "@/lib/plan/build-plan";
import type { SessionTemplate } from "@/lib/plan/template";

export function PlanBuilder({ signals, template }: { signals: Signals; template: SessionTemplate }) {
  const [state, action, pending] = useActionState<FormState, FormData>(confirmPlan, {});
  const plan = useMemo(() => buildPlan(signals, template), [signals, template]);
  const topicsFor = (key: string) => template.sittings.find((s) => s.key === key)?.topics ?? [];

  return (
    <form action={action} className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          {plan.length} sessions, about {formatMinutes(totalMinutes(plan))} in total.
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
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <Note>
        This order is only a suggestion. Start any session whenever suits, stop part-way through,
        and come back to it later.
      </Note>

      <FormError message={state.error ?? null} />
      <SubmitButton pending={pending}>{pending ? "Saving…" : "Use this plan"}</SubmitButton>
    </form>
  );
}
