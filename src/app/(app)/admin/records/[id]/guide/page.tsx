import Link from "next/link";
import { notFound } from "next/navigation";
import { collectRecord } from "@/lib/artifact/collect";
import { renderGuide } from "@/lib/artifact/render";
import { requireAdmin } from "@/lib/session";
import { todayInMelbourne } from "@/lib/today";
import { DocumentView } from "../document-view";

export const metadata = { title: "The Guide · The Handover" };
export const dynamic = "force-dynamic";

export default async function GuidePage({ params }: PageProps<"/admin/records/[id]/guide">) {
  await requireAdmin();
  const { id } = await params;
  const data = await collectRecord(id);
  if (!data) notFound();

  const markdown = renderGuide(data, { version: "draft", preparedOn: todayInMelbourne() });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-10">
      <div className="flex flex-col gap-1 print:hidden">
        <Link href={`/admin/records/${id}`} className="text-sm text-foreground/60 underline">
          Back to the record
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">The Guide</h1>
        <p className="text-sm text-foreground/70">
          Built from what&apos;s recorded, in template order. Nothing here is written by a model, so the same
          record always produces the same document.
        </p>
      </div>
      <DocumentView markdown={markdown} filename={`guide-${data.header.subject_name.toLowerCase()}.md`} />
    </main>
  );
}
