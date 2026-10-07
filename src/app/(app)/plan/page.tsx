import { redirect } from "next/navigation";
import { TopicPreview } from "@/components/topics";
import { Badge, ButtonLink, Card, Note, Page, PageHeader, Progress } from "@/components/ui";
import { sessionTemplate } from "@/lib/content";
import { journeyFor, possessive } from "@/lib/journey";
import { addDays, formatMinutes, totalMinutes } from "@/lib/plan/build-plan";
import { requireSession } from "@/lib/session";
import { formatDay, todayInMelbourne } from "@/lib/today";
import { MoveSitting } from "./move-sitting";
import { StartSitting } from "./start-sitting";

export const metadata = { title: "Your plan · The Handover" };
export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const { user } = await requireSession();
  const journey = await journeyFor(user.id);
  if (!journey.record) redirect("/home");
  const { record, sittings, done } = journey;
  if (!sittings.length) redirect("/home");

  const today = todayInMelbourne();
  const byKey = new Map<string, (typeof sessionTemplate.sittings)[number]>(
    sessionTemplate.sittings.map((s) => [s.key, s]),
  );

  return (
    <Page>
      <PageHeader
        eyebrow="The sittings ahead"
        title={`${possessive(record)} plan`}
        lead="Each sitting covers one part of the record and stands on its own. They're short on purpose, and the order is a suggestion like the dates are."
      />

      <Card tone="quiet" className="flex flex-col gap-2">
        <p className="text-sm text-muted">
          {done} of {sittings.length} done · about{" "}
          {formatMinutes(totalMinutes(sittings.map((s) => ({ minutes: s.estimated_minutes }))))} in total
        </p>
        <Progress value={done} max={sittings.length} label="Sittings done" />
      </Card>

      <ol className="flex flex-col gap-4">
        {sittings.map((s) => {
          const template = byKey.get(s.sitting_key);
          return (
            <li key={s.id}>
              <Card tone={s.status === "in_progress" ? "accent" : "plain"} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <h2 className="text-xl">
                      <span className="mr-3 tabular-nums text-faint">{s.seq}</span>
                      {s.title}
                    </h2>
                    <Status status={s.status} />
                  </div>
                  <p className="measure text-muted">{template?.summary}</p>
                </div>

                {template && s.status !== "done" && <TopicPreview topics={template.topics} />}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                  <span className="text-sm text-muted">
                    about {formatMinutes(s.estimated_minutes)}
                    {s.status === "done" ? "" : ` · suggested for ${formatDay(s.scheduled_for)}`}
                  </span>
                  {s.status === "planned" && (
                    <MoveSitting sittingId={s.id} date={s.scheduled_for} min={today} max={addDays(today, 365)} />
                  )}
                </div>

                {s.status === "planned" && <StartSitting sittingId={s.id} title={s.title} />}
                {s.status === "in_progress" && (
                  <ButtonLink href="/sitting" className="self-start">
                    Carry on
                  </ButtonLink>
                )}
              </Card>
            </li>
          );
        })}
      </ol>

      <Note>
        The dates are a suggestion, not a deadline — start a sitting whenever it suits, and stop
        part-way whenever you need to. Nothing is lost by stopping.
      </Note>
    </Page>
  );
}

function Status({ status }: { status: string }) {
  if (status === "done") return <Badge tone="recorded">Done</Badge>;
  if (status === "in_progress") return <Badge tone="accent">Open now</Badge>;
  if (status === "skipped") return <Badge>Skipped</Badge>;
  return <Badge tone="outstanding">To do</Badge>;
}
