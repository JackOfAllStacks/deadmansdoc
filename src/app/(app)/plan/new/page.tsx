import { redirect } from "next/navigation";
import { Page, PageHeader } from "@/components/ui";
import { sessionTemplate } from "@/lib/content";
import { getRecordForUser, listSittings } from "@/lib/records";
import { requireSession } from "@/lib/session";
import { addDays } from "@/lib/plan/build-plan";
import { todayInMelbourne } from "@/lib/today";
import { PlanBuilder } from "./plan-builder";

export const metadata = { title: "Your plan · The Handover" };

export default async function NewPlanPage() {
  const { user } = await requireSession();
  const record = await getRecordForUser(user.id);
  if (!record?.intake_completed_at) redirect("/home");
  if ((await listSittings(record.id)).length) redirect("/plan");

  const today = todayInMelbourne();
  const whose = record.subject_relationship === "self" ? "your" : `${record.subject_name}'s`;

  return (
    <Page width="prose">
      <PageHeader
        eyebrow="From the opening conversation"
        title={`A plan for ${whose} handover`}
        lead="Here's how the rest could be broken up. Each sitting is short and covers one part of the record. Choose when to start and how often; any of them can be moved later."
      />
      <PlanBuilder
        signals={record.intake}
        template={sessionTemplate}
        today={today}
        latest={addDays(today, 365)}
        defaultStart={addDays(today, 1)}
      />
    </Page>
  );
}
