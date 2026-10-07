import { redirect } from "next/navigation";
import { DocumentPage } from "@/components/document";
import { ButtonLink, Card, Note, Page, PageHeader } from "@/components/ui";
import { collectRecord } from "@/lib/artifact/collect";
import { envelopeDoc, renderEnvelope } from "@/lib/artifact/render";
import { journeyFor } from "@/lib/journey";
import { requireSession } from "@/lib/session";
import { todayInMelbourne } from "@/lib/today";
import { DocumentActions } from "../document-actions";

export const metadata = { title: "The sealed envelope · The Handover" };
export const dynamic = "force-dynamic";

export default async function MyEnvelopePage() {
  const { user } = await requireSession();
  const journey = await journeyFor(user.id);
  if (!journey.record) redirect("/start");

  const data = await collectRecord(journey.record.id);
  if (!data) redirect("/home");

  const meta = { version: "draft", preparedOn: todayInMelbourne() };
  const doc = envelopeDoc(data, meta);
  const markdown = renderEnvelope(data, meta);

  return (
    <Page width="prose">
      <div className="flex flex-col gap-4 print:hidden">
        <PageHeader
          eyebrow="Kept separately"
          title="The sealed envelope"
          lead="Figures, and anything recorded as private. It is kept out of the Guide and printed on its own, to be opened only after death — but it is your record, so you can read it here whenever you want."
        />
        {doc && markdown && (
          <DocumentActions markdown={markdown} filename={`envelope-${data.header.subject_name.toLowerCase()}.md`} />
        )}
      </div>

      {doc ? (
        <>
          <Note>
            Nothing in here appears in the Guide. The Guide says an envelope exists and leaves a
            marker where something was taken out, so your family know to look for it.
          </Note>
          <DocumentPage doc={doc} />
        </>
      ) : (
        <Card tone="quiet" className="flex flex-col items-start gap-3">
          <h2 className="text-lg">There is no envelope</h2>
          <p className="measure text-sm text-muted">
            Nothing recorded so far has been kept back, so everything is in the Guide itself. If
            something private comes up in a later sitting, an envelope will print then.
          </p>
          <ButtonLink href="/guide" tone="secondary">
            Back to the Guide
          </ButtonLink>
        </Card>
      )}
    </Page>
  );
}
