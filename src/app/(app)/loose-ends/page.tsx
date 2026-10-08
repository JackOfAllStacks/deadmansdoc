import { redirect } from "next/navigation";
import { ButtonLink, Card, EmptyState, Note, Page, PageHeader, Stat } from "@/components/ui";
import { countLooseEnds, groupLooseEnds, looseEnds } from "@/lib/artifact/gaps";
import { journeyFor, possessiveLower } from "@/lib/journey";
import { requireSession } from "@/lib/session";
import { knownEntities } from "@/lib/sitting/capture";
import { LooseEndGroupPanel } from "./loose-ends-list";

export const metadata = { title: "Still to find out · The Handover" };
export const dynamic = "force-dynamic";

/**
 * What's still to find out.
 *
 * Every "I don't know" in the record is kept as content rather than left as a
 * blank, with whoever might know and how much it matters. This is the page
 * that makes that worth having: the one place the record asks something of
 * the person rather than the other way round.
 */
export default async function LooseEndsPage() {
  const { user } = await requireSession();
  const journey = await journeyFor(user.id);
  if (!journey.record) redirect("/home");
  const { record, sittings } = journey;

  const [ends, known] = await Promise.all([looseEnds(record.id), knownEntities(record.id)]);
  const { total, routed, pressing } = countLooseEnds(ends);
  const groups = groupLooseEnds(ends);
  const people = known.filter((k) => k.entityType === "person").map((k) => k.label);
  const sittingTitles = new Map(sittings.map((s) => [s.sitting_key, s.title]));

  if (!total) {
    return (
      <Page>
        <PageHeader
          eyebrow="The open questions"
          title="Nothing outstanding"
          lead={`Everything ${possessiveLower(record)} record has been asked about so far has an answer. Anything nobody knows will turn up here as it comes up.`}
        />
        <EmptyState>
          A conversation that ends in &ldquo;I don&apos;t know&rdquo; hasn&apos;t failed — that
          answer gets written down too, and this is where it waits.
        </EmptyState>
        <ButtonLink href="/home" tone="quiet">
          Back to where things are up to
        </ButtonLink>
      </Page>
    );
  }

  return (
    <Page width="wide">
      <PageHeader
        eyebrow="The open questions"
        title="What's still to find out"
        lead={
          <>
            {total === 1 ? "One thing nobody" : `${total} things nobody`} has the answer to yet.{" "}
            {routed === 0
              ? "Nobody has been named for any of them, which is the thing to change first — a question with somebody attached is one a family can follow."
              : routed === total
                ? "Every one of them has somebody who might know."
                : `${routed} of them have somebody who might know.`}
          </>
        }
      />

      {/* Grouped by who to ask, because two questions for Peter are one
          errand and not two. */}
      <Card tone="quiet">
        <div className="flex flex-wrap gap-x-12 gap-y-4">
          <Stat label="Still to find out">{total}</Stat>
          <Stat label="Have somebody to ask">
            {routed} of {total}
          </Stat>
          <Stat label="Matter most">{pressing}</Stat>
        </div>
      </Card>

      <div className="flex flex-col gap-8">
        {groups.map((group) => (
          <LooseEndGroupPanel
            key={group.who ?? "\u0000unrouted"}
            group={group}
            people={people}
            sittingTitles={Object.fromEntries(sittingTitles)}
          />
        ))}
      </div>

      <Note>
        Writing an answer in here is the same as correcting the document during a session — it goes
        through the same checks, and it shows up in the Guide straight away. Nothing has to be
        answered: a question with the right person&apos;s name on it is already worth more to a
        family than a blank.
      </Note>
    </Page>
  );
}
