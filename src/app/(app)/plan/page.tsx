import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionTemplate } from "@/lib/content";
import { addDays, formatMinutes, totalMinutes } from "@/lib/plan/build-plan";
import { getRecordForUser, listSittings } from "@/lib/records";
import { requireSession } from "@/lib/session";
import { formatDay, todayInMelbourne } from "@/lib/today";
import { MoveSitting } from "./move-sitting";
import { StartSitting } from "./start-sitting";

export const metadata = { title: "Your plan · The Handover" };

const STATUS_LABEL = { planned: "Planned", in_progress: "In progress", done: "Done", skipped: "Skipped" } as const;

export default async function PlanPage() {
  const { user } = await requireSession();
  const record = await getRecordForUser(user.id);
  if (!record) redirect("/home");
  const sittings = await listSittings(record.id);
  if (!sittings.length) redirect("/home");

  const done = sittings.filter((s) => s.status === "done").length;
  const today = todayInMelbourne();
  const summaries = new Map<string, string>(sessionTemplate.sittings.map((s) => [s.key, s.summary]));
  const whose = record.subject_relationship === "self" ? "Your" : `${record.subject_name}'s`;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{whose} plan</h1>
        <p className="text-foreground/80">
          {done} of {sittings.length} sittings done · about {formatMinutes(totalMinutes(sittings.map((s) => ({ minutes: s.estimated_minutes }))))} in total
        </p>
        <div
          className="h-2 overflow-hidden rounded-full bg-foreground/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={sittings.length}
          aria-valuenow={done}
        >
          <div className="h-full bg-foreground" style={{ width: `${(done / sittings.length) * 100}%` }} />
        </div>
      </header>

      <ol className="flex flex-col gap-3">
        {sittings.map((s) => (
          <li key={s.id} className="flex flex-col gap-3 rounded-md border border-foreground/15 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <span className="font-medium">
                <span className="mr-3 tabular-nums text-foreground/40">{s.seq}</span>
                {s.title}
              </span>
              <span className="text-sm text-foreground/60">
                about {formatMinutes(s.estimated_minutes)} · {STATUS_LABEL[s.status]}
              </span>
            </div>
            <p className="text-sm text-foreground/70">{summaries.get(s.sitting_key)}</p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-foreground/70">
                {s.status === "done" ? "Done" : `Suggested for ${formatDay(s.scheduled_for)}`}
              </span>
              {s.status === "planned" && (
                <MoveSitting sittingId={s.id} date={s.scheduled_for} min={today} max={addDays(today, 365)} />
              )}
            </div>
            {s.status === "planned" && <StartSitting sittingId={s.id} title={s.title} />}
            {s.status === "in_progress" && (
              <Link
                href="/sitting"
                className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
              >
                Carry on
              </Link>
            )}
          </li>
        ))}
      </ol>

      <p className="rounded-md bg-foreground/5 p-4 text-sm text-foreground/80">
        The dates are a suggestion, not a deadline — start a sitting whenever it suits, and stop
        part-way whenever you need to. Nothing is lost by stopping.
      </p>
    </main>
  );
}
