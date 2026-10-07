import { Card, Note, Page, PageHeader, SectionHeading } from "@/components/ui";
import { listAccounts } from "@/lib/admin";
import { personas } from "@/lib/demo/personas";
import { requireAdmin } from "@/lib/session";
import { SeedForm } from "./seed-form";

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
    </Page>
  );
}
