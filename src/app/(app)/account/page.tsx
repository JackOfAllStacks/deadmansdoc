import { ButtonLink, Card, Page, PageHeader, SectionHeading } from "@/components/ui";
import { journeyFor } from "@/lib/journey";
import { requireSession } from "@/lib/session";
import { ChangeName, DeleteAccount } from "./account-forms";

export const metadata = { title: "Your account · The Handover" };
export const dynamic = "force-dynamic";

const RELATIONSHIP_LABEL = {
  self: "yourself",
  parent: "your parent",
  other: "someone close to you",
} as const;

export default async function AccountPage() {
  const { user } = await requireSession();
  const { record, sittings, done } = await journeyFor(user.id);

  return (
    <Page width="prose">
      <PageHeader title="Your account" />

      <section className="flex flex-col gap-4">
        <SectionHeading>Your details</SectionHeading>
        <p className="measure text-sm text-muted">
          Signed in as {user.email}. Your name is what the conversation calls you, and what
          &ldquo;who&rsquo;s here today&rdquo; starts from.
        </p>
        <ChangeName name={user.name} />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading>Your record</SectionHeading>
        {record ? (
          <>
            <p className="measure text-sm text-muted">
              A record about {record.subject_name}, for {RELATIONSHIP_LABEL[record.subject_relationship]}.
              {sittings.length
                ? ` ${done} of ${sittings.length} sittings done.`
                : record.intake_completed_at
                  ? " The opening conversation is done; the plan comes next."
                  : " The opening conversation hasn't finished yet."}
            </p>
            <ButtonLink href="/home" tone="quiet" className="self-start">
              Go to it
            </ButtonLink>
          </>
        ) : (
          <p className="text-sm text-muted">
            You haven&apos;t started a record yet.{" "}
            <ButtonLink href="/start" tone="quiet">
              Start one
            </ButtonLink>
          </p>
        )}
      </section>

      <Card className="flex flex-col gap-4 border-danger/30">
        <h2 className="text-lg">Delete your account</h2>
        <p className="measure text-sm text-muted">
          This removes your account and everything in your record: the conversation, the plan, and
          everything recorded so far. It happens straight away and can&apos;t be undone. Anything
          you&apos;ve already printed stays printed.
        </p>
        <DeleteAccount />
      </Card>
    </Page>
  );
}
