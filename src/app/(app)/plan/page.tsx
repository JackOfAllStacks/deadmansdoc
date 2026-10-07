import { redirect } from "next/navigation";
import { TopicChips } from "@/components/topics";
import { areaOf, Badge, ButtonLink, Card, cx, Note, Page, PageHeader, Progress, Stat } from "@/components/ui";
import { sessionTemplate } from "@/lib/content";
import { journeyFor, possessive } from "@/lib/journey";
import { addDays, formatMinutes, totalMinutes } from "@/lib/plan/build-plan";
import type { SittingRow } from "@/lib/records";
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
  const minutes = totalMinutes(sittings.map((s) => ({ minutes: s.estimated_minutes })));
  const left = totalMinutes(sittings.filter((s) => s.status !== "done").map((s) => ({ minutes: s.estimated_minutes })));

  return (
    <Page width="wide">
      <PageHeader
        eyebrow="The sittings ahead"
        title={`${possessive(record)} plan`}
        lead="Each sitting covers one part of the record and stands on its own. They're short on purpose, and the order is a suggestion like the dates are."
      />

      {/* The summary bar: three numbers and a line, rather than a paragraph. */}
      <Card tone="quiet" className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-x-12 gap-y-4">
          <Stat label="Done">
            {done} of {sittings.length}
          </Stat>
          <Stat label="Still to do">{formatMinutes(left)}</Stat>
          <Stat label="In total">{formatMinutes(minutes)}</Stat>
        </div>
        <Progress value={done} max={sittings.length} label="Sittings done" />
      </Card>

      {/* Every card the same width. A spanning one leaves a hole beside
          whichever card precedes it, and "Open now" marks itself anyway. */}
      <ol className="grid gap-4 lg:grid-cols-2">
        {sittings.map((s) => (
          <li key={s.id}>
            <SittingCard
              sitting={s}
              summary={byKey.get(s.sitting_key)?.summary}
              topics={byKey.get(s.sitting_key)?.topics ?? []}
              today={today}
            />
          </li>
        ))}
      </ol>

      <Note>
        The dates are a suggestion, not a deadline — start a sitting whenever it suits, and stop
        part-way whenever you need to. Nothing is lost by stopping.
      </Note>
    </Page>
  );
}

function SittingCard({
  sitting,
  summary,
  topics,
  today,
}: {
  sitting: SittingRow;
  summary?: string;
  topics: { label: string; blurb: string; covers: string[] }[];
  today: string;
}) {
  const area = areaOf(sitting.sitting_key);
  const open = sitting.status === "in_progress";

  return (
    <Card
      tone={open ? "accent" : "plain"}
      className={cx("flex h-full flex-col gap-3 border-l-4", area.edge)}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <h2 className={cx("text-lg leading-snug", area.text)}>
          <span className="mr-2.5 tabular-nums text-faint">{sitting.seq}</span>
          {sitting.title}
        </h2>
        <Status status={sitting.status} />
      </div>

      <p className="text-sm leading-relaxed text-muted">{summary}</p>

      {sitting.status !== "done" && topics.length > 0 && <TopicChips topics={topics} />}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <span className="text-sm text-muted">
          about {formatMinutes(sitting.estimated_minutes)}
          {sitting.status === "done" ? "" : ` · ${formatDay(sitting.scheduled_for)}`}
        </span>
        {sitting.status === "planned" && (
          <MoveSitting
            sittingId={sitting.id}
            date={sitting.scheduled_for}
            min={today}
            max={addDays(today, 365)}
          />
        )}
      </div>

      {sitting.status === "planned" && <StartSitting sittingId={sitting.id} title={sitting.title} />}
      {open && (
        <ButtonLink href="/sitting" className="self-start">
          Carry on with this one
        </ButtonLink>
      )}
    </Card>
  );
}

function Status({ status }: { status: string }) {
  if (status === "done") return <Badge tone="recorded">Done</Badge>;
  if (status === "in_progress") return <Badge tone="accent">Open now</Badge>;
  if (status === "skipped") return <Badge>Skipped</Badge>;
  return <Badge tone="outstanding">To do</Badge>;
}
