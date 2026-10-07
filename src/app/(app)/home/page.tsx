import { redirect } from "next/navigation";
import { StartSitting } from "@/app/(app)/plan/start-sitting";
import { TopicChips } from "@/components/topics";
import {
  Badge,
  ButtonLink,
  Card,
  Note,
  Page,
  PageHeader,
  Progress,
  SectionHeading,
} from "@/components/ui";
import { sessionTemplate } from "@/lib/content";
import { journeyFor, possessive, possessiveLower, type Journey } from "@/lib/journey";
import { formatMinutes, totalMinutes } from "@/lib/plan/build-plan";
import { requireSession } from "@/lib/session";
import { filledFields } from "@/lib/sitting/capture";
import { sittingFields } from "@/lib/sitting/coverage";
import { formatDay, todayInMelbourne } from "@/lib/today";

export const metadata = { title: "Home · The Handover" };
export const dynamic = "force-dynamic";

/**
 * Home.
 *
 * This used to be a redirect that worked out where you were up to and sent you
 * there, which is what made the product a corridor with no rooms. It is now the
 * room: what this is, how far through you are, the one thing to do next, and
 * what has actually been recorded so far.
 */
export default async function HomePage() {
  const { user } = await requireSession();
  const journey = await journeyFor(user.id);
  // Nothing to show a dashboard about yet — the first screen is still consent.
  if (!journey.record) redirect("/start");

  const { record, sittings, done, stage } = journey;
  const whose = possessive(record);
  const minutes = totalMinutes(sittings.map((s) => ({ minutes: s.estimated_minutes })));

  return (
    <Page>
      <PageHeader
        eyebrow={record.subject_relationship === "self" ? "Your handover" : `A handover for ${record.subject_name}`}
        title={stage === "complete" ? "Every sitting is done" : `Where ${possessiveLower(record)} handover is up to`}
        lead={
          stage === "complete"
            ? "What was said has been written into the record. You can go back over any part of it whenever you like."
            : "A record of what the people you leave behind will need to know. It's built up over a few short conversations, and none of it has to be finished today."
        }
      />

      <NextStep journey={journey} />

      {sittings.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionHeading aside={`about ${formatMinutes(minutes)} in total`}>{whose} sittings</SectionHeading>
          <Card tone="quiet" className="flex flex-col gap-2">
            <p className="text-sm text-muted">
              {done} of {sittings.length} done
            </p>
            <Progress value={done} max={sittings.length} label="Sittings done" />
          </Card>
          <ul className="grid gap-3 sm:grid-cols-2">
            {sittings.map((s) => {
              const topics = sessionTemplate.sittings.find((t) => t.key === s.sitting_key)?.topics ?? [];
              return (
                <li key={s.id}>
                  <Card tone="plain" className="flex h-full flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base leading-snug">{s.title}</h3>
                      <SittingBadge status={s.status} />
                    </div>
                    <p className="text-sm text-muted">
                      {s.status === "done"
                        ? `about ${formatMinutes(s.estimated_minutes)}`
                        : `about ${formatMinutes(s.estimated_minutes)} · suggested for ${formatDay(s.scheduled_for)}`}
                    </p>
                    <div className="mt-auto pt-1">
                      <TopicChips topics={topics} />
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
          <ButtonLink href="/plan" tone="quiet" className="self-start">
            Open the plan to start one, or move a date
          </ButtonLink>
        </section>
      )}

      {sittings.length > 0 && <RecordedSoFar recordId={record.id} />}

      <Note>
        The dates are suggestions, not deadlines. Start a sitting whenever it suits, stop part-way
        whenever you need to, and nothing is lost by stopping.
      </Note>
    </Page>
  );
}

function SittingBadge({ status }: { status: string }) {
  if (status === "done") return <Badge tone="recorded">Done</Badge>;
  if (status === "in_progress") return <Badge tone="accent">Open</Badge>;
  if (status === "skipped") return <Badge>Skipped</Badge>;
  return <Badge tone="outstanding">To do</Badge>;
}

/** The one thing to do next, said plainly and put above everything else. */
function NextStep({ journey }: { journey: Journey }) {
  const { record, open, next, stage } = journey;
  if (!record) return null;

  if (stage === "intake") {
    return (
      <Card tone="accent" className="flex flex-col items-start gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg">Finish the opening conversation</h2>
          <p className="measure text-sm text-muted">
            A few short questions, so the sittings after it are the right shape. It picks up exactly
            where you left it.
          </p>
        </div>
        <ButtonLink href="/start/intake">Carry on</ButtonLink>
      </Card>
    );
  }

  if (stage === "planning") {
    return (
      <Card tone="accent" className="flex flex-col items-start gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg">Set the rhythm</h2>
          <p className="measure text-sm text-muted">
            The sittings are worked out. All that&apos;s left is choosing when to start and how often.
          </p>
        </div>
        <ButtonLink href="/plan/new">See the plan</ButtonLink>
      </Card>
    );
  }

  if (open) {
    return (
      <Card tone="accent" className="flex flex-col items-start gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg">{open.title} is still open</h2>
          <p className="measure text-sm text-muted">
            You stopped part-way through. Everything said so far is saved.
          </p>
        </div>
        <ButtonLink href="/sitting">Carry on with it</ButtonLink>
      </Card>
    );
  }

  if (next) {
    const today = todayInMelbourne();
    return (
      <Card tone="accent" className="flex flex-col items-start gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg">Next: {next.title}</h2>
          <p className="measure text-sm text-muted">
            About {formatMinutes(next.estimated_minutes)}.{" "}
            {next.scheduled_for > today
              ? `Suggested for ${formatDay(next.scheduled_for)} — but there's nothing to wait for.`
              : "Ready whenever you are."}
          </p>
        </div>
        <StartSitting sittingId={next.id} title={next.title} />
      </Card>
    );
  }

  return (
    <Card tone="accent" className="flex flex-col items-start gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg">Nothing left to book in</h2>
        <p className="measure text-sm text-muted">
          Every sitting in the plan has been done. What was said is in the record.
        </p>
      </div>
      <ButtonLink href="/plan" tone="secondary">
        Look back over the plan
      </ButtonLink>
    </Card>
  );
}

/** A count of what is actually in the record, so progress isn't only a bar. */
async function RecordedSoFar({ recordId }: { recordId: string }) {
  const filled = await filledFields(recordId);
  if (!filled.length) return null;

  const answered = filled.filter((f) => f.status === "answered").length;
  const gaps = filled.filter((f) => f.status === "unknown").length;
  const everything = sessionTemplate.sittings.flatMap((s) => sittingFields(s.covers)).length;

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading>What&apos;s in the record</SectionHeading>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card tone="quiet">
          <p className="font-serif text-2xl">{answered}</p>
          <p className="text-sm text-muted">things recorded</p>
        </Card>
        <Card tone="quiet">
          <p className="font-serif text-2xl">{gaps}</p>
          <p className="text-sm text-muted">noted as nobody knows yet</p>
        </Card>
        <Card tone="quiet">
          <p className="font-serif text-2xl">{Math.max(0, everything - answered - gaps)}</p>
          <p className="text-sm text-muted">still to come</p>
        </Card>
      </div>
      <p className="measure text-sm text-muted">
        A gap counts as much as an answer: &ldquo;nobody knows where that is&rdquo; is exactly the
        sort of thing a family needs to be told.
      </p>
    </section>
  );
}
