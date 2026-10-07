import { redirect } from "next/navigation";
import { Card, Note, Page, PageHeader, Progress, Stat } from "@/components/ui";
import { sessionTemplate } from "@/lib/content";
import { journeyFor, possessive } from "@/lib/journey";
import { addDays, formatMinutes, totalMinutes } from "@/lib/plan/build-plan";
import { requireSession } from "@/lib/session";
import { todayInMelbourne } from "@/lib/today";
import { PlanList, type PlanItem } from "./plan-list";

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
  const left = totalMinutes(
    sittings.filter((s) => s.status !== "done").map((s) => ({ minutes: s.estimated_minutes })),
  );

  const items: PlanItem[] = sittings.map((s) => ({
    id: s.id,
    seq: s.seq,
    title: s.title,
    sittingKey: s.sitting_key,
    status: s.status,
    minutes: s.estimated_minutes,
    date: s.scheduled_for,
    summary: byKey.get(s.sitting_key)?.summary ?? "",
    topics: byKey.get(s.sitting_key)?.topics ?? [],
  }));

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

      <PlanList items={items} today={today} latest={addDays(today, 365)} />

      <Note>
        The dates are a suggestion, not a deadline — start a sitting whenever it suits, and stop
        part-way whenever you need to. Nothing is lost by stopping.
      </Note>
    </Page>
  );
}
