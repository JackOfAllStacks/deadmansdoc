import { redirect } from "next/navigation";
import { DocumentContents, DocumentPage } from "@/components/document";
import { ButtonLink, Card, Note, Page, PageHeader } from "@/components/ui";
import { collectRecord } from "@/lib/artifact/collect";
import { guideDoc, hasSealedContent } from "@/lib/artifact/render";
import { renderGuide } from "@/lib/artifact/render";
import { journeyFor, possessive, possessiveLower } from "@/lib/journey";
import { progressFor } from "@/lib/progress";
import { filledFields } from "@/lib/sitting/capture";
import { requireSession } from "@/lib/session";
import { todayInMelbourne } from "@/lib/today";
import { DocumentActions } from "./document-actions";

export const metadata = { title: "The Guide · The Handover" };
export const dynamic = "force-dynamic";

/**
 * The Guide, read by the person whose record it is.
 *
 * Until now only an admin could see this, which in a product built on trust,
 * about someone's own death, was the wrong way round. It is also the most
 * reassuring screen there is: everything said so far, in the shape it will be
 * handed over in.
 */
export default async function MyGuidePage() {
  const { user } = await requireSession();
  const journey = await journeyFor(user.id);
  if (!journey.record) redirect("/start");

  const data = await collectRecord(journey.record.id);
  if (!data) redirect("/home");

  const meta = { version: "draft", preparedOn: todayInMelbourne() };
  const doc = guideDoc(data, meta);
  const markdown = renderGuide(data, meta);
  const recorded = data.values.filter((v) => v.status === "answered").length;
  const whose = possessiveLower(journey.record);
  const progress = progressFor(await filledFields(journey.record.id), possessive(journey.record));

  return (
    <Page width="wide">
      <div className="flex flex-col gap-4 print:hidden">
        <PageHeader
          eyebrow="What this is all for"
          title="The Guide"
          lead={
            recorded > 0
              ? `Everything recorded so far, in the shape it would be handed over in. It is built from what was said — nothing here was written by a machine, and nothing appears that nobody mentioned.`
              : `This is what the sittings are building. It fills in as you go.`
          }
        />
        {/* How much of it exists, said where the document itself is, so the
            measure is the thing being made rather than a count of
            conversations had about it. */}
        {recorded > 0 && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <DocumentActions markdown={markdown} downloadHref="/api/guide/download" />
            <p className="text-sm text-muted">
              {progress.answered + progress.gaps} of {progress.total} parts covered
              {progress.met.length > 0 &&
                ` · ${progress.met.length} of ${progress.milestones.length} things ${whose} family would know`}
            </p>
          </div>
        )}
      </div>

      {recorded === 0 ? (
        <Card tone="quiet" className="flex flex-col items-start gap-3">
          <h2 className="text-lg">Nothing in it yet</h2>
          <p className="measure text-sm text-muted">
            Once you have been through a sitting, what was said appears here. You can come back to
            this page at any point to see what {whose} handover looks like so far.
          </p>
          <ButtonLink href="/plan">Go to the plan</ButtonLink>
        </Card>
      ) : (
        <>
          <Note>
            This is a working draft, not a finished document, and not a legal one. Anything still
            missing is marked as missing rather than hidden — a gap with a name beside it is worth
            more to your family than a blank.
          </Note>

          {/* Wide screens get the sections down the side: a finished record
              runs to several screens, and a scroll bar is not navigation. */}
          <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
            <aside className="hidden lg:block print:hidden">
              <div className="sticky top-24">
                <DocumentContents doc={doc} />
              </div>
            </aside>
            <DocumentPage doc={doc} />
          </div>

          {hasSealedContent(data) && (
            <Card tone="quiet" className="flex flex-col items-start gap-3 print:hidden">
              <h2 className="text-lg">The sealed envelope</h2>
              <p className="measure text-sm text-muted">
                Some of what you have recorded — figures, and anything you said should stay private
                — is kept out of this document and printed separately. It is yours, so you can read
                it whenever you like.
              </p>
              <ButtonLink href="/guide/envelope" tone="secondary">
                Read the sealed envelope
              </ButtonLink>
            </Card>
          )}
        </>
      )}
    </Page>
  );
}
