import { redirect } from "next/navigation";
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">A plan for {whose} handover</h1>
        <p className="leading-relaxed text-foreground/80">
          Based on that conversation, here&apos;s how the rest could be broken up. Each sitting is short
          and covers one part of the record. Choose when you&apos;d like to start and how often to meet;
          you can move any sitting later.
        </p>
      </header>
      <PlanBuilder
        signals={record.intake}
        template={sessionTemplate}
        today={today}
        latest={addDays(today, 365)}
        defaultStart={addDays(today, 1)}
      />
    </main>
  );
}
