import type { SittingTopic } from "@/lib/plan/template";
import type { TopicProgress } from "@/lib/sitting/coverage";
import { Badge, Card, cx } from "@/components/ui";

/*
 * The scaffolding.
 *
 * The problem these solve: an empty chat box asks a person to work out for
 * themselves what is worth saying about their own death. These say what ground
 * is being covered, in words written for a person rather than field ids, and —
 * during a sitting — how much of each area has been settled.
 *
 * They deliberately don't list the underlying questions. Showing the whole
 * checklist would turn the conversation back into a form, which is the thing
 * the conversation exists to avoid.
 */

/** Before a sitting, or on the plan: the areas it will cover, no progress. */
export function TopicPreview({ topics }: { topics: SittingTopic[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {topics.map((topic) => (
        <li key={topic.label} className="rounded-md border border-line bg-surface p-4">
          <p className="font-medium">{topic.label}</p>
          <p className="mt-1 text-sm text-muted">{topic.blurb}</p>
        </li>
      ))}
    </ul>
  );
}

/** A compact row of area names, for a plan card where space is short. */
export function TopicChips({ topics }: { topics: SittingTopic[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {topics.map((topic) => (
        <li key={topic.label}>
          <Badge>{topic.label}</Badge>
        </li>
      ))}
    </ul>
  );
}

function Tick({ state }: { state: "done" | "started" | "waiting" }) {
  const styles = {
    done: "border-recorded bg-recorded text-white",
    started: "border-unknown bg-unknown-soft text-unknown",
    waiting: "border-line-strong text-transparent",
  } as const;
  return (
    <span
      aria-hidden
      className={cx(
        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] leading-none",
        styles[state],
      )}
    >
      {state === "done" ? "✓" : "•"}
    </span>
  );
}

/** During a sitting: the same areas, filling in as the conversation goes. */
export function TopicChecklist({ topics }: { topics: TopicProgress[] }) {
  const finished = topics.filter((t) => t.done).length;
  return (
    <Card tone="plain" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base">What we&apos;re covering</h2>
        <span className="text-sm text-muted">
          {finished} of {topics.length}
        </span>
      </div>
      <ul className="flex flex-col gap-3">
        {topics.map((topic) => {
          const state = topic.done ? "done" : topic.started ? "started" : "waiting";
          return (
            <li key={topic.label} className="flex gap-2.5">
              <Tick state={state} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className={cx("text-sm leading-snug", state === "waiting" ? "text-muted" : "font-medium")}>
                  {topic.label}
                </span>
                {state === "waiting" ? (
                  <span className="text-xs leading-snug text-faint">{topic.blurb}</span>
                ) : (
                  <span className="text-xs text-muted">
                    {topic.answered} recorded
                    {topic.gaps > 0 && `, ${topic.gaps} to find out`} of {topic.total}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs leading-snug text-faint">
        Nothing has to be covered in order, and anything nobody knows can be left for someone else to
        answer later.
      </p>
    </Card>
  );
}
