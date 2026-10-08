import {
  ConversationSpot,
  DocumentsSpot,
  GuideSheet,
  OpenedEnvelope,
  SealedEnvelope,
  SessionsSpot,
} from "@/components/illustrations";
import { Backdrop } from "@/components/backdrop";
import { Mark, Wordmark } from "@/components/mark";
import { areaOf, ButtonLink, Card, cx } from "@/components/ui";
import { sessionTemplate } from "@/lib/content";

export const metadata = {
  title: "The Handover: what the people you leave behind will need to know",
  description:
    "A guided conversation that writes down who your family should call, what you have and where it's kept, so they aren't left guessing.",
};

const STEPS: [string, string, typeof ConversationSpot][] = [
  [
    "Start with a short chat",
    "About five minutes, and rough answers are fine. It works out which parts of your life will take the most time.",
    ConversationSpot,
  ],
  [
    "Then a few short sessions",
    "Each one covers one area and takes up to half an hour. Do them whenever suits you, all in one day or over a few weeks. You can stop partway and pick up where you left off.",
    SessionsSpot,
  ],
  [
    "End up with a document to keep",
    "Everything you said, written up so your family can follow it. Anything private is printed separately, in a sealed envelope.",
    DocumentsSpot,
  ],
];

// What a family finds in the Guide, said the way they'd look for it rather
// than by the template's section names.
const IN_THE_GUIDE = [
  "Who to ring first, and who to ring about what",
  "What has to happen in the first days, and what can wait",
  "Accounts and bills, and what has to keep running",
  "What nobody knows yet, and who might",
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Wordmark size="sm" className="whitespace-nowrap" />
          <nav className="flex items-center gap-3">
            <ButtonLink href="/sign-in" tone="quiet" className="whitespace-nowrap">
              Sign in
            </ButtonLink>
            {/* On a phone the hero's own button is a thumb away; two in a
                row there just wrap. */}
            <span className="hidden sm:block">
              <ButtonLink href="/sign-up" size="sm" className="whitespace-nowrap">
                Create an account
              </ButtonLink>
            </span>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* ── Hero ───────────────────────────────────────────────────── */}
        <section className="relative isolate overflow-hidden border-b border-line">
          <Backdrop variant="hero" />
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 pt-10 pb-14 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16 lg:pt-12 lg:pb-16">
            <div className="flex flex-col items-start gap-6">
              <p className="inline-flex items-center gap-2 rounded-full bg-leaf-soft px-3 py-1 text-sm font-medium text-accent ring-1 ring-leaf/50">
                In development
              </p>
              <h1 className="text-4xl leading-[1.1] sm:text-5xl lg:text-6xl">
                What the people you leave behind will need to know.
              </h1>
              <p className="measure text-lg leading-relaxed text-muted">
                The Handover helps you write down who your family should call, what you have, and
                where it&apos;s kept. It asks the questions, a little at a time, so you don&apos;t have
                to work out where to start.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <ButtonLink href="/sign-up">Start a handover</ButtonLink>
                <ButtonLink href="/sign-in" tone="quiet">
                  Sign in
                </ButtonLink>
              </div>
              <p className="text-sm text-faint">
                This isn&apos;t a will and has no legal effect. It covers the practical things a will
                leaves out.
              </p>
            </div>

            <OpenedEnvelope className="lg:mr-0" />
          </div>
        </section>

        {/* ── How it works ───────────────────────────────────────────── */}
        <section className="relative isolate overflow-hidden border-b border-line">
          <Backdrop variant="band" />
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8">
            <h2 className="text-2xl">How it works</h2>
            <ol className="mt-8 grid gap-5 md:grid-cols-3">
              {STEPS.map(([title, detail, Spot], i) => (
                <li key={title}>
                  <Card tone="raised" className="flex h-full flex-col gap-3">
                    <div className="-mx-1 mb-1 flex items-end justify-between gap-4 rounded-md bg-leaf-soft px-4 pt-4 pb-3">
                      <Spot className="h-20 w-auto" />
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-serif text-base text-accent">
                        {i + 1}
                      </span>
                    </div>
                    <h3 className="text-lg leading-snug">{title}</h3>
                    <p className="text-sm leading-relaxed text-muted">{detail}</p>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── What it covers ─────────────────────────────────────────── */}
        <section className="border-b border-line">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
            <div className="flex flex-col gap-4">
              <h2 className="text-2xl">What it covers</h2>
              <p className="measure leading-relaxed text-muted">
                This first version covers four areas: the things a family needs most in the first
                days and weeks, and the things that are hardest to piece together later. Each
                session covers one of them.
              </p>
              <p className="measure text-sm leading-relaxed text-faint">
                If nobody knows the answer to something, the Guide says so and names who might. That
                is more use to a family than a blank.
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
                <div className="-mx-1 mb-1 flex justify-center rounded-md bg-leaf-soft py-4">
                  <GuideSheet className="h-32 w-auto" />
                </div>
                <h3 className="text-xl">The Guide</h3>
                <p className="text-sm leading-relaxed text-muted">
                  This is what your family reads. Everything in it comes from what you said, and
                  nothing is made up to fill a gap. Your family can read it at any time.
                </p>
                <ul className="mt-1 flex flex-col gap-1.5 text-sm text-muted">
                  {IN_THE_GUIDE.map((line) => (
                    <li key={line} className="flex gap-2.5">
                      <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-leaf" />
                      {line}
                    </li>
                  ))}
                </ul>
              </Card>
              <Card tone="plain" className="flex flex-col gap-3">
                <div className="-mx-1 mb-1 flex justify-center rounded-md bg-leaf-soft py-4">
                  <SealedEnvelope className="h-32 w-auto" />
                </div>
                <h3 className="text-xl">The Sealed Envelope</h3>
                <p className="text-sm leading-relaxed text-muted">
                  Balances, amounts, and anything else you&apos;d want written down but not left
                  lying around. These are printed separately, to be opened only after death.
                </p>
                <p className="text-sm leading-relaxed text-muted">
                  The Guide tells your family the envelope exists, and marks each place where
                  something has been moved into it. Nobody is left wondering whether there is one.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* ── Close ──────────────────────────────────────────────────── */}
        <section className="relative isolate overflow-hidden">
          <Backdrop variant="rings" />
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-5 py-16 sm:px-8 lg:items-center lg:py-20 lg:text-center">
            <Mark className="size-10 text-accent" />
            <h2 className="measure text-3xl leading-tight">
              It&apos;s a conversation nobody gets around to having.
            </h2>
            <p className="measure leading-relaxed text-muted">
              It works best with two people: the person it&apos;s about, and someone who&apos;ll need
              the answers. You can stop at any point and come back to it later.
            </p>
            <ButtonLink href="/sign-up">Start a handover</ButtonLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-faint sm:px-8">
          <Wordmark size="sm" className="text-muted" />
          <p>Not a will, and no legal effect. An early version, still being built.</p>
        </div>
      </footer>
    </div>
  );
}
