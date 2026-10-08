import { redirect } from "next/navigation";
import { Page } from "@/components/ui";
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
    // The height of what's left below the nav, at every width -- no page on
    // the screen is taller than the screen.
    //
    // From lg the two panes share it and each scrolls inside itself, so the
    // composer is always on screen without scrolling the page to it. Below
    // lg they are tabs: the conversation behaves the same way, and the
    // document, which is read rather than talked to, is as tall as it is and
    // scrolls this instead, taking the tabs with it.
    <Page
      width="full"
      pad="tight"
      className="h-0 flex-1 overflow-y-auto lg:overflow-hidden"
    >
      {/* No page header: the heading belongs to the conversation and is
          rendered inside it, so the document pane starts level with the top
          of the screen rather than below a band of title. See SittingHead. */}
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
