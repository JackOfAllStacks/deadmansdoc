import { redirect } from "next/navigation";
import { Page, PageHeader } from "@/components/ui";
import { sessionTemplate } from "@/lib/content";
import { formatMinutes } from "@/lib/plan/build-plan";
import { getRecordForUser } from "@/lib/records";
import { requireSession } from "@/lib/session";
import { MAX_MESSAGE_LENGTH } from "@/lib/sitting/agent";
import { capturedIn, filledFields, knownEntities } from "@/lib/sitting/capture";
import { coverageOf, topicProgress, topicsFor } from "@/lib/sitting/coverage";
import { documentOutline, looseNotes } from "@/lib/sitting/document";
import { greetingFor } from "@/lib/sitting/prompt";
import { isBusy, openSitting, sittingMessages } from "@/lib/sitting/store";
import { toChatHistory } from "@/lib/transcript";
import { SittingChat } from "./sitting-chat";

export const metadata = { title: "Your session · The Handover" };
export const dynamic = "force-dynamic";

export default async function SittingPage() {
  const { user } = await requireSession();
  const record = await getRecordForUser(user.id);
  if (!record) redirect("/home");

  const sitting = await openSitting(record.id);
  if (!sitting) redirect("/plan");

  const [stored, captured, filled, entities] = await Promise.all([
    sittingMessages(sitting.id),
    capturedIn(sitting.id),
    filledFields(record.id),
    knownEntities(record.id),
  ]);

  const history = toChatHistory(stored);
  const summary = sessionTemplate.sittings.find((s) => s.key === sitting.sitting_key)?.summary ?? "";
  const topics = topicsFor(sitting.sitting_key);

  // Wider than the rest of the app: the conversation and the document it is
  // writing sit side by side here, and both need room to be read.
  return (
    // On a phone this is the height of what's left below the header. Showing
    // the conversation, nothing overflows it -- the conversation scrolls
    // inside itself and the box you type into stays put. Showing the
    // document, the document is as tall as it is and this scrolls, taking the
    // tabs with it, which is what reading rather than talking wants.
    <Page
      width="full"
      className="max-sm:h-0 max-sm:flex-1 max-sm:gap-4 max-sm:overflow-y-auto max-sm:py-5"
    >
      {/* Below lg this is inside the conversation instead, so it scrolls away
          with it rather than holding the top of a small screen. */}
      <div className="max-lg:hidden">
        <PageHeader
          eyebrow={`Session ${sitting.seq} · about ${formatMinutes(sitting.estimated_minutes)}`}
          title={sitting.title}
          lead={summary}
        />
      </div>
      <SittingChat
        eyebrow={`Session ${sitting.seq} · about ${formatMinutes(sitting.estimated_minutes)}`}
        title={sitting.title}
        lead={summary}
        greeting={greetingFor(record, sitting, summary)}
        history={history}
        outline={documentOutline(sitting.covers, captured)}
        notes={looseNotes(captured)}
        people={entities.filter((e) => e.entityType === "person").map((e) => e.label)}
        coverage={coverageOf(sitting.covers, filled)}
        topics={topicProgress(topics, filled)}
        maxLength={MAX_MESSAGE_LENGTH}
        busy={isBusy(sitting)}
      />
    </Page>
  );
}
