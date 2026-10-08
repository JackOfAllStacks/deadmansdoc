import { redirect } from "next/navigation";
import { StartSitting } from "@/app/(app)/plan/start-sitting";
import { TopicChips } from "@/components/topics";
import {
  areaOf,
  Badge,
  ButtonLink,
  Card,
  CardLink,
  cx,
  EmptyState,
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
import { progressFor } from "@/lib/progress";
import { filledFields } from "@/lib/sitting/capture";

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
  const left = totalMinutes(
    sittings.filter((s) => s.status !== "done").map((s) => ({ minutes: s.estimated_minutes })),
  );

  return (
    <Page width="wide">
      <PageHeader
        eyebrow={record.subject_relationship === "self" ? "Your handover" : `A handover for ${record.subject_name}`}
        title={stage === "complete" ? "Every session is done" : `Where ${possessiveLower(record)} handover is up to`}
        lead={
          stage === "complete"
            ? "What was said has been written into the record. You can go back over any part of it whenever you like."
            : "A record of what the people you leave behind will need to know. It's built up over a few short conversations, and none of it has to be finished today."
        }
      />

      <NextStep journey={journey} />

      {sittings.length > 0 && <WhereItStands recordId={record.id} whose={whose} />}

      {sittings.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionHeading
            aside={stage === "complete" ? `about ${formatMinutes(minutes)} in total` : `about ${formatMinutes(left)} left`}
          >
            {whose} sessions
          </SectionHeading>
          {/* Deliberately below the record and not above it: this is the
              schedule, not the achievement. A sitting can finish having
              recorded very little. */}
          <Card tone="quiet" className="flex flex-col gap-2">
            <p className="text-sm text-muted">
              {done} of {sittings.length} conversations done
            </p>
            <Progress value={done} max={sittings.length} label="Sessions done" />
          </Card>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {sittings.map((s) => {
              const topics = sessionTemplate.sittings.find((t) => t.key === s.sitting_key)?.topics ?? [];
              const area = areaOf(s.sitting_key);
              return (
                <li key={s.id}>
                  <Card tone="plain" className={cx("flex h-full flex-col gap-2 border-l-4", area.edge)}>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className={cx("text-base leading-snug", area.text)}>{s.title}</h3>
                      <SittingBadge status={s.status} />
                    </div>
                    <p className="text-sm text-muted">
                      about {formatMinutes(s.estimated_minutes)}
                    </p>
                    <div className="mt-auto pt-1">
                      <TopicChips topics={topics} />
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <ButtonLink href="/plan" tone="quiet">
              {stage === "complete" ? "Look back over the plan" : "Open the plan to start one"}
            </ButtonLink>
            <ButtonLink href="/guide" tone="quiet">
              Read the Guide as it stands
            </ButtonLink>
          </div>
        </section>
      )}

      <Note>
        There are no deadlines. Start a session whenever it suits — one at a time, or several in a
        day — stop part-way whenever you need to, and nothing is lost by stopping.
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
            A few short questions, so the sessions after it are the right shape. It picks up exactly
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
          <h2 className="text-lg">Your plan is ready</h2>
          <p className="measure text-sm text-muted">
            The sessions are worked out. Have a look, then start whichever one you like.
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
    return (
      <Card tone="accent" className="flex flex-col items-start gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg">Next: {next.title}</h2>
          <p className="measure text-sm text-muted">
            About {formatMinutes(next.estimated_minutes)}. Ready whenever you are.
          </p>
        </div>
        <StartSitting sittingId={next.id} title={next.title} />
      </Card>
    );
  }

  return (
    <Card tone="accent" className="flex flex-col items-start gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg">Nothing left to do</h2>
        <p className="measure text-sm text-muted">
          Every session in the plan has been done. What was said is in the record.
        </p>
      </div>
      <ButtonLink href="/plan" tone="secondary">
        Look back over the plan
      </ButtonLink>
    </Card>
  );
}

/*
 * Where the record stands.
 *
 * The number that used to lead here was sittings done, and a count of sittings
 * measures a schedule rather than an achievement: a sitting can finish having
 * recorded very little. So the record itself is the measure now, and the
 * sittings are the thing that gets you there.
 *
 * Under it, what that adds up to in plain terms -- and those claims are
 * earned, never written. A claim only appears once every field behind it holds
 * an answer, so the product can't tell somebody their family would know who to
 * ring when what is written down is that nobody knows. See
 * data/milestones.yaml.
 */
async function WhereItStands({ recordId, whose }: { recordId: string; whose: string }) {
  const filled = await filledFields(recordId);
  if (!filled.length) return null;
  const p = progressFor(filled, whose);

  return (
    <>
      <section className="flex flex-col gap-4">
        <SectionHeading aside={`${p.answered + p.gaps} of ${p.total} covered`}>
          What&apos;s in the record
        </SectionHeading>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card tone="quiet" className="flex flex-col gap-1">
            <p className="font-serif text-3xl text-recorded">{p.answered}</p>
            <p className="text-sm text-muted">things recorded</p>
          </Card>
          {/* A gap is the one thing in the record that asks something of the
              person afterwards, so this number is a way through rather than a
              tally. With none of them there's nowhere worth going. */}
          {p.gaps > 0 ? (
            <CardLink href="/loose-ends" className="flex flex-col gap-1">
              <p className="font-serif text-3xl text-unknown">{p.gaps}</p>
              <p className="text-sm text-muted">noted as nobody knows yet — see what&apos;s left to find out</p>
            </CardLink>
          ) : (
            <Card tone="quiet" className="flex flex-col gap-1">
              <p className="font-serif text-3xl text-unknown">0</p>
              <p className="text-sm text-muted">noted as nobody knows yet</p>
            </Card>
          )}
          <Card tone="quiet" className="flex flex-col gap-1">
            <p className="font-serif text-3xl text-faint">{p.outstanding}</p>
            <p className="text-sm text-muted">still to come</p>
          </Card>
        </div>

        <p className="measure text-sm text-muted">
          A gap counts as much as an answer: &ldquo;nobody knows where that is&rdquo; is exactly the
          sort of thing a family needs to be told.
        </p>

        {/* The document's own sections, so what is filling up is the thing
            that gets printed rather than a tally of conversations. */}
        <ul className="grid gap-3 sm:grid-cols-2">
          {p.sections.map((section) => (
            <li key={section.id}>
              <Card tone="plain" className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h3 className="text-base">{section.title}</h3>
                  {section.complete ? (
                    <Badge tone="recorded">Answered</Badge>
                  ) : section.settled ? (
                    <Badge tone="unknown">Nothing left to ask</Badge>
                  ) : (
                    <span className="text-sm text-muted">
                      {section.answered + section.gaps} of {section.total}
                    </span>
                  )}
                </div>
                {/* Answers, then gaps in the colour gaps get everywhere else,
                    so the bar adds up to the number beside it without the two
                    kinds of covered pretending to be the same thing. */}
                <Progress
                  value={section.answered}
                  also={section.gaps}
                  max={section.total}
                  label={`${section.title}: ${section.answered} answered, ${section.gaps} not known, of ${section.total}`}
                  tone="recorded"
                />
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {(p.met.length > 0 || p.next) && (
        <section className="flex flex-col gap-4">
          <SectionHeading aside={p.met.length > 0 ? `${p.met.length} of ${p.milestones.length}` : undefined}>
            What that already means
          </SectionHeading>

          {p.met.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {p.met.map((m) => (
                <li key={m.id}>
                  <Card tone="quiet" className="flex items-start gap-3">
                    <Tick />
                    <p className="measure leading-relaxed">{m.says}</p>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>
              Nothing to say yet. These fill in as the record does, and each one is a thing the
              people you leave behind would actually be able to do.
            </EmptyState>
          )}

          {p.next && (
            <Card tone="accent" className="flex flex-col gap-2">
              <p className="text-xs font-medium tracking-wide text-faint uppercase">
                {p.next.missing.length === 1 ? "One answer away" : `${p.next.missing.length} answers away`}
              </p>
              <p className="measure leading-relaxed">{p.next.says}</p>
              <p className="measure text-sm text-muted">
                Still to cover: {p.next.missing.map((f) => f.label.toLowerCase()).join("; ")}.
              </p>
            </Card>
          )}
        </section>
      )}
    </>
  );
}

function Tick() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="mt-1 size-4 shrink-0 text-recorded" fill="none">
      <path
        d="M4 10.5 8 14.5 16 5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
