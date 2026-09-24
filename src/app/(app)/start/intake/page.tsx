import { redirect } from "next/navigation";
import { greetingFor } from "@/lib/intake/prompt";
import { MAX_MESSAGE_LENGTH } from "@/lib/intake/agent";
import { getRecordForUser, intakeMessages, speakersFor } from "@/lib/records";
import { requireSession } from "@/lib/session";
import { toChatHistory } from "@/lib/transcript";
import { IntakeChat } from "./intake-chat";

export const metadata = { title: "A first conversation · The Handover" };

export default async function IntakePage() {
  const { user } = await requireSession();
  const record = await getRecordForUser(user.id);
  if (!record) redirect("/start");
  if (record.intake_completed_at) redirect("/home");

  const history = toChatHistory(await intakeMessages(record.id));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">A first conversation</h1>
        <p className="text-foreground/70">
          A few questions to plan the sittings ahead. There&apos;s no need for detail yet.
        </p>
      </header>
      <IntakeChat
        greeting={greetingFor(record)}
        history={history}
        speakers={speakersFor(record)}
        maxLength={MAX_MESSAGE_LENGTH}
      />
    </main>
  );
}
