import { redirect } from "next/navigation";
import { Card, Page, PageHeader } from "@/components/ui";
import { artifact } from "@/lib/content";
import { getRecordForUser } from "@/lib/records";
import { requireSession } from "@/lib/session";
import { StartForm } from "./start-form";

export const metadata = { title: "Getting started · The Handover" };

export default async function StartPage() {
  const { user } = await requireSession();
  if (await getRecordForUser(user.id)) redirect("/home");

  const inScope = artifact.sections.filter((s) => artifact.scope.includes(s.number));

  return (
    <Page width="prose">
      <PageHeader
        eyebrow="First time here"
        title="Getting started"
        lead="The Handover records what the people you leave behind will need to know: who to call, what exists, and where to find it. It works best when two people do it together, and it's done over a few short sittings rather than all at once."
      />

      <Card tone="quiet" className="flex flex-col gap-3">
        <h2 className="text-base">What it ends up covering</h2>
        <ul className="flex flex-col gap-1.5 text-sm">
          {inScope.map((s) => (
            <li key={s.id} className="flex gap-3">
              <span className="w-4 shrink-0 text-right tabular-nums text-faint">{s.number}</span>
              <span>{s.title}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          Nothing has to be answered today, and anything nobody knows is worth recording as exactly
          that.
        </p>
      </Card>

      <StartForm accountName={user.name} />
    </Page>
  );
}
