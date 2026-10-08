import { Mark, Wordmark } from "@/components/mark";
import { areaOf, ButtonLink, Card, cx } from "@/components/ui";
import { artifact, sessionTemplate } from "@/lib/content";

export const metadata = {
  title: "The Handover — what the people you leave behind will need to know",
  description:
    "A guided conversation that records who to call, what exists, and where to find it — written down while someone is still here to be asked.",
};

const STEPS: [string, string][] = [
  [
    "A short conversation to begin",
    "About five minutes, and rough answers only. It works out which parts of your life need the most time.",
  ],
  [
    "A handful of short sessions",
    "Half an hour at most, one area each, whenever suits. Stop part-way whenever you like — nothing is lost.",
  ],
  [
    "A document you can hand over",
    "Everything said, written up the way your family will need to read it, with anything private kept separately.",
  ],
];

export default function Home() {
  const inScope = artifact.sections.filter((s) => artifact.scope.includes(s.number));

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Wordmark size="sm" />
          <nav className="flex items-center gap-3">
            <ButtonLink href="/sign-in" tone="quiet">
              Sign in
            </ButtonLink>
            <ButtonLink href="/sign-up" size="sm">
              Create an account
            </ButtonLink>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* ── Hero ───────────────────────────────────────────────────── */}
        <section className="border-b border-line bg-surface">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16 lg:py-24">
            <div className="flex flex-col items-start gap-6">
              <p className="inline-flex items-center gap-2 rounded-full bg-warm-soft px-3 py-1 text-sm font-medium text-warm">
                In development
              </p>
              <h1 className="text-4xl leading-[1.1] sm:text-5xl lg:text-6xl">
                What the people you leave behind will need to know.
              </h1>
              <p className="measure text-lg leading-relaxed text-muted">
                Who to call. What exists. Where to find it. The Handover asks, a bit at a time, and
                writes it down properly — while someone is still here to be asked.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <ButtonLink href="/sign-up">Start a handover</ButtonLink>
                <ButtonLink href="/sign-in" tone="quiet">
                  I already have an account
                </ButtonLink>
              </div>
              <p className="text-sm text-faint">
                It isn&apos;t a will, and it has no legal effect. It&apos;s the practical half nobody
                writes down.
              </p>
            </div>

            <Preview />
          </div>
        </section>

        {/* ── How it works ───────────────────────────────────────────── */}
        <section className="border-b border-line">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8">
            <h2 className="text-2xl">How it works</h2>
            <ol className="mt-8 grid gap-5 md:grid-cols-3">
              {STEPS.map(([title, detail], i) => (
                <li key={title}>
                  <Card tone="raised" className="flex h-full flex-col gap-3">
                    <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft font-serif text-base text-accent">
                      {i + 1}
                    </span>
                    <h3 className="text-lg leading-snug">{title}</h3>
                    <p className="text-sm leading-relaxed text-muted">{detail}</p>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── What it covers ─────────────────────────────────────────── */}
        <section className="border-b border-line bg-surface">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
            <div className="flex flex-col gap-4">
              <h2 className="text-2xl">What it covers</h2>
              <p className="measure leading-relaxed text-muted">
                The first version covers the four things a family needs in the first week and the
                first year — the parts that are hardest to reconstruct once someone has gone.
              </p>
              <p className="measure text-sm leading-relaxed text-faint">
                Each session covers one of them. Anything nobody knows is recorded as exactly that,
                with the name of whoever might: a gap with someone attached is worth more than a
                blank.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {sessionTemplate.sittings.map((sitting) => {
                const area = areaOf(sitting.key);
                return (
                  <li key={sitting.key}>
                    <div
                      className={cx(
                        "flex h-full flex-col gap-2 rounded-lg border border-l-4 border-line p-4",
                        area.edge,
                      )}
                    >
                      <h3 className={cx("text-base leading-snug", area.text)}>{sitting.title}</h3>
                      <p className="text-sm leading-relaxed text-muted">{sitting.summary}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ── The two documents ──────────────────────────────────────── */}
        <section className="border-b border-line">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8">
            <div className="grid gap-5 md:grid-cols-2">
              <Card tone="plain" className="flex flex-col gap-3">
                <h3 className="text-xl">The Guide</h3>
                <p className="text-sm leading-relaxed text-muted">
                  What the family reads. Who to call first, what has to happen and in what order,
                  what must not be touched yet, and where everything is kept. Built from what was
                  said — not written by a machine, and nothing in it that nobody mentioned.
                </p>
                <ul className="mt-1 flex flex-col gap-1.5 text-sm text-muted">
                  {inScope.map((s) => (
                    <li key={s.id} className="flex gap-2.5">
                      <span className="tabular-nums text-faint">{s.number}</span>
                      {s.title}
                    </li>
                  ))}
                </ul>
              </Card>
              <Card tone="plain" className="flex flex-col gap-3">
                <h3 className="text-xl">The Sealed Envelope</h3>
                <p className="text-sm leading-relaxed text-muted">
                  Figures, and anything else you&apos;d write down but not leave lying about. Kept
                  out of the Guide and printed separately, to be opened only after death.
                </p>
                <p className="text-sm leading-relaxed text-muted">
                  The Guide still says it exists, and leaves a marker where something was taken out —
                  so nobody spends the worst week of their life hunting for an envelope they were
                  never told about.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* ── Close ──────────────────────────────────────────────────── */}
        <section className="bg-surface">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-5 py-16 sm:px-8 lg:items-center lg:py-20 lg:text-center">
            <Mark className="size-10 text-accent" />
            <h2 className="measure text-3xl leading-tight">
              It&apos;s a conversation nobody gets around to having.
            </h2>
            <p className="measure leading-relaxed text-muted">
              It works best with two people — one who knows the answers, and one who&apos;ll need
              them. A few short sessions, and you can stop at any point.
            </p>
            <ButtonLink href="/sign-up">Start a handover</ButtonLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-faint sm:px-8">
          <Wordmark size="sm" className="text-muted" />
          <p>Not a will. No legal effect. A prototype, in development.</p>
        </div>
      </footer>
    </div>
  );
}

/**
 * A still of the product beside the hero. Deliberately a drawing rather than a
 * screenshot: a screenshot of a record about an invented death invites you to
 * read it, and it would need re-shooting every time the interface moved.
 */
function Preview() {
  const rows: [string, string, string][] = [
    ["people", "Who to ring first", "Robyn — wife · call her before anyone else"],
    ["first-days", "The first few days", "Register the death · ring the funeral director"],
    ["money-out", "What must not stop", "The rates. Nobody is told; it just accrues"],
    ["money-in-owed", "Still to find out", "Who the accountant is — Robyn may know"],
  ];

  return (
    <Card tone="raised" className="flex flex-col gap-4 lg:ml-auto lg:max-w-md">
      <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
        <h2 className="text-base">The Guide, so far</h2>
        <span className="text-xs text-muted">3 of 4 sessions done</span>
      </div>
      <ul className="flex flex-col gap-3.5">
        {rows.map(([key, label, value]) => {
          const area = areaOf(key);
          return (
            <li key={label} className="flex gap-3">
              <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", area.dot)} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs font-medium text-muted">{label}</span>
                <span className="text-sm leading-snug">{value}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-line pt-3 text-xs text-faint">An example, not a real record.</p>
    </Card>
  );
}
