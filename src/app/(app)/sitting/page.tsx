import { redirect } from "next/navigation";
import { Page, PageHeader } from "@/components/ui";
import { sessionTemplate } from "@/lib/content";
import { formatMinutes } from "@/lib/plan/build-plan";
import { getRecordForUser, speakersFor } from "@/lib/records";
import { requireSession } from "@/lib/session";
import { MAX_MESSAGE_LENGTH } from "@/lib/sitting/agent";
import { capturedIn, filledFields } from "@/lib/sitting/capture";
import { coverageOf, topicProgress, topicsFor } from "@/lib/sitting/coverage";
import { greetingFor } from "@/lib/sitting/prompt";
import { isBusy, openSitting, sittingMessages } from "@/lib/sitting/store";
import { toChatHistory } from "@/lib/transcript";
import { SittingChat } from "./sitting-chat";

export const metadata = { title: "Your sitting · The Handover" };
export const dynamic = "force-dynamic";

export default async function SittingPage() {
  const { user } = await requireSession();
  const record = await getRecordForUser(user.id);
  if (!record) redirect("/home");

  const sitting = await openSitting(record.id);
  if (!sitting) redirect("/plan");

  const [stored, captured, filled] = await Promise.all([
    sittingMessages(sitting.id),
    capturedIn(sitting.id),
    filledFields(record.id),
  ]);

  const history = toChatHistory(stored);
  const summary = sessionTemplate.sittings.find((s) => s.key === sitting.sitting_key)?.summary ?? "";
  const topics = topicsFor(sitting.sitting_key);

  return (
    <Page width="wide">
      <PageHeader
        eyebrow={`Sitting ${sitting.seq} · about ${formatMinutes(sitting.estimated_minutes)}`}
        title={sitting.title}
        lead={summary}
      />
      <SittingChat
        greeting={greetingFor(record, sitting, summary)}
        history={history}
        captured={captured}
        coverage={coverageOf(sitting.covers, filled)}
        topics={topicProgress(topics, filled)}
        speakers={speakersFor(record)}
        maxLength={MAX_MESSAGE_LENGTH}
        busy={isBusy(sitting)}
      />
    </Page>
  );
}
