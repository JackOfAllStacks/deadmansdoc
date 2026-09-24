import Link from "next/link";
import { notFound } from "next/navigation";
import { collectRecord } from "@/lib/artifact/collect";
import { renderEnvelope } from "@/lib/artifact/render";
import { requireAdmin } from "@/lib/session";
import { todayInMelbourne } from "@/lib/today";
import { DocumentView } from "../document-view";

export const metadata = { title: "The Sealed Envelope · The Handover" };
export const dynamic = "force-dynamic";

export default async function EnvelopePage({ params }: PageProps<"/admin/records/[id]/envelope">) {
  await requireAdmin();
  const { id } = await params;
  const data = await collectRecord(id);
  if (!data) notFound();

  const markdown = renderEnvelope(data, { version: "draft", preparedOn: todayInMelbourne() });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-10">
      <div className="flex flex-col gap-1 print:hidden">
        <Link href={`/admin/records/${id}`} className="text-sm text-foreground/60 underline">
          Back to the record
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">The Sealed Envelope</h1>
        <p className="text-sm text-foreground/70">
          Printed separately and opened only after death. One sealed item is enough for it to exist — there is
          no minimum.
        </p>
      </div>
      {markdown ? (
        <DocumentView markdown={markdown} filename={`envelope-${data.header.subject_name.toLowerCase()}.md`} />
      ) : (
        <p className="rounded-md border border-foreground/15 p-4 text-sm">
          Nothing in this record is sealed, so no envelope prints. The Guide says as much, so nobody goes
          looking for one that doesn&apos;t exist.
        </p>
      )}
    </main>
  );
}
