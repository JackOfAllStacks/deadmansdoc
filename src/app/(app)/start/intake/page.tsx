import { redirect } from "next/navigation";
import { Page, PageHeader } from "@/components/ui";
import { sessionTemplate } from "@/lib/content";
import { MAX_MESSAGE_LENGTH } from "@/lib/intake/agent";
import { greetingFor } from "@/lib/intake/prompt";
import { journeyFor, possessiveLower } from "@/lib/journey";
import { intakeMessages, speakersFor } from "@/lib/records";
import { requireSession } from "@/lib/session";
import { toChatHistory } from "@/lib/transcript";
import { IntakeChat } from "./intake-chat";

export const metadata = { title: "The opening conversation · The Handover" };
export const dynamic = "force-dynamic";

/**
 * No longer a dead end once it's finished. It stays readable, because it's the
 * only place that says why the plan came out the way it did — and it can be
 * reopened to add something, which rebuilds the sittings not yet started.
 */
export default async function IntakePage() {
  const { user } = await requireSession();
  const journey = await journeyFor(user.id);
  const record = journey.record;
  if (!record) redirect("/start");

  const history = toChatHistory(await intakeMessages(record.id));
  const areas = sessionTemplate.sittings.map((s) => ({ title: s.title, summary: s.summary }));

  return (
    <Page width="prose">
      <PageHeader
        eyebrow="Before the sittings"
        title="The opening conversation"
        lead={`A few short questions about ${possessiveLower(record)} situation, so that the sittings after it are the right ones, in the right order, and the right length.`}
      />
      <IntakeChat
        greeting={greetingFor(record)}
        history={history}
        speakers={speakersFor(record)}
        maxLength={MAX_MESSAGE_LENGTH}
        areas={areas}
        finished={Boolean(record.intake_completed_at)}
        hasPlan={journey.sittings.length > 0}
      />
    </Page>
  );
}
