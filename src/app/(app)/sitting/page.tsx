import { redirect } from "next/navigation";
import { sessionTemplate } from "@/lib/content";
import { getRecordForUser, speakersFor } from "@/lib/records";
import { requireSession } from "@/lib/session";
import { MAX_MESSAGE_LENGTH } from "@/lib/sitting/agent";
import { capturedIn, filledFields } from "@/lib/sitting/capture";
import { coverageOf } from "@/lib/sitting/coverage";
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

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-foreground/60">
          Sitting {sitting.seq} · about {sitting.estimated_minutes} minutes
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{sitting.title}</h1>
        <p className="text-foreground/70">{summary}</p>
      </header>

      <SittingChat
        greeting={greetingFor(record, sitting, summary)}
        history={history}
        captured={captured}
        coverage={coverageOf(sitting.covers, filled)}
        speakers={speakersFor(record)}
        maxLength={MAX_MESSAGE_LENGTH}
        busy={isBusy(sitting)}
      />
    </main>
  );
}
