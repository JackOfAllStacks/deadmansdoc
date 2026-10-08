import { Card, Note, Page, PageHeader, SectionHeading } from "@/components/ui";
import { listAccounts } from "@/lib/admin";
import { db } from "@/lib/db";
import { personas } from "@/lib/demo/personas";
import { SHOWCASE } from "@/lib/demo/showcase";
import { scriptedSittings } from "@/lib/demo/run";
import { requireAdmin } from "@/lib/session";
import { RunForm } from "./run-form";
import { SeedForm } from "./seed-form";
import { ShowcaseForm } from "./showcase-form";

export const metadata = { title: "Demo records · The Handover" };
export const dynamic = "force-dynamic";

/**
 * Filling an account with a made-up person, so a demo doesn't mean improvising
 * answers or paying for model calls to show what the product already does.
 *
 * It fills an account that already exists rather than making one, which keeps
 * every question about passwords and sign-up out of here entirely.
 */
export default async function DemoPage() {
  await requireAdmin();
  const accounts = await listAccounts();
  const emails: string[] = SHOWCASE.map((a) => a.email);
  const made = new Set(
    ((await db()`select email from "user" where email = any(${emails})`) as { email: string }[]).map((r) => r.email),
  );
  const scripted = personas.flatMap((p) =>
    p.script?.intake?.length ? [{ key: p.key, name: p.name, sittings: scriptedSittings(p).length }] : [],
  );

  return (
    <Page>
      <PageHeader
        eyebrow="Admin"
        title="Demo records"
        lead="Fills an account with an invented person — the plan, what was said, what was recorded, and the gaps. Instant, free, and repeatable: no model is involved."
      />

      <Note>
        These people are made up and nothing in them is real. Seeding{" "}
        <strong className="font-semibold">replaces</strong> whatever record that account already
        had, so point it at an account kept for demos rather than your own.
      </Note>

      <section className="flex flex-col gap-4">
        <SectionHeading aside="to hand out">Accounts for showing people</SectionHeading>
        <p className="measure text-sm text-muted">
          Three accounts at three points — not started, half way, finished — for someone to sign in
          to and click round. Setting them up again puts all three back how they started, so do it
          after each person has had a go. They share one record each, so two people in the same
          account at once will see each other&apos;s changes.
        </p>
        <ShowcaseForm accounts={SHOWCASE.map((a) => ({ email: a.email, label: a.label, exists: made.has(a.email) }))} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading>Who you can seed</SectionHeading>
        <ul className="grid gap-3 sm:grid-cols-2">
          {personas.map((persona) => (
            <li key={persona.key}>
              <Card tone="plain" className="flex h-full flex-col gap-2">
                <h3 className="text-base">{persona.name}</h3>
                <p className="text-sm text-muted">{persona.summary}</p>
                <p className="mt-auto pt-2 text-xs text-faint">
                  {persona.sittings.filter((s) => s.status === "done").length} of{" "}
                  {persona.sittings.length} sittings done · {(persona.record ?? []).length} things
                  recorded
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading>Seed one</SectionHeading>
        <SeedForm personas={personas.map((p) => ({ key: p.key, name: p.name }))} accounts={accounts} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading aside="costs roughly US$0.50">Watch one being made</SectionHeading>
        <p className="measure text-sm text-muted">
          Seeding shows the result; this shows the experience. A persona&apos;s own words are typed
          into the real pages at a pace you can follow — consent, the opening conversation, the
          plan, then every sitting in the plan&apos;s order with the document filling in beside
          it, and the Guide at the end. Start it and watch: it needs nothing from you. The model is
          real, so it costs credit and takes ten minutes or so.
        </p>
        <Note>
          It runs in a new account made for it, so this browser is{" "}
          <strong className="font-semibold">signed out of yours</strong> while it plays. Sign back
          in afterwards; the record stays readable from the admin pages.
        </Note>
        <RunForm personas={scripted} />
      </section>
    </Page>
  );
}
