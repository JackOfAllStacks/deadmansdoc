import Link from "next/link";
import { notFound } from "next/navigation";
import { artifact, sectionFields } from "@/lib/content";
import { collectRecord, getTranscript, type ValueRow } from "@/lib/artifact/collect";
import { standingsFromData, type Standing } from "@/lib/artifact/evaluate";
import { hasSealedContent } from "@/lib/artifact/render";
import { requireAdmin } from "@/lib/session";
import { Completeness } from "./completeness";

export const metadata = { title: "A record · The Handover" };
export const dynamic = "force-dynamic";

const STANDING_LABEL: Record<Standing, string> = {
  recorded: "Recorded",
  "not-known": "Not known",
  "does-not-apply": "Doesn't apply",
  "not-covered": "Not covered yet",
};

function valueText(row: ValueRow, labelOf: (id: string) => string): string {
  if (row.status === "unknown") {
    return row.who_would_know ? `Not known — ${row.who_would_know} may know` : "Not known";
  }
  const v = row.value;
  if (row.entity_instance_id) return labelOf(row.entity_instance_id);
  if (Array.isArray(v)) return v.join(" · ");
  if (v && typeof v === "object") return Object.values(v).join(" ");
  return String(v ?? "");
}

export default async function AdminRecordPage({ params }: PageProps<"/admin/records/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const data = await collectRecord(id);
  if (!data) notFound();
  const transcript = await getTranscript(id);

  const entityLabel = new Map(data.entities.map((e) => [e.id, e.label]));
  const labelOf = (entityId: string) => entityLabel.get(entityId) ?? "(unknown entry)";
  const standings = standingsFromData(data);
  const sections = artifact.sections.filter((s) => artifact.scope.includes(s.number));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-6 py-10">
      <header className="flex flex-col gap-2">
        <Link href="/admin" className="text-sm text-muted underline">
          Back to admin
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{data.header.subject_name}</h1>
        <p className="text-sm text-muted">
          {data.header.owner_email} · started {new Date(data.header.created_at).toLocaleDateString("en-AU")} ·{" "}
          {data.header.present.join(", ") || "nobody"} present at consent
        </p>
        {data.header.intake?.summary && (
          <p className="rounded-md bg-soft p-3 text-sm">{data.header.intake.summary}</p>
        )}
        <div className="flex flex-wrap gap-3 pt-1">
          <Link
            href={`/admin/records/${id}/guide`}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
          >
            The Guide
          </Link>
          <Link
            href={`/admin/records/${id}/envelope`}
            className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-soft"
          >
            {hasSealedContent(data) ? "The Sealed Envelope" : "No envelope (nothing sealed)"}
          </Link>
        </div>
      </header>

      <Completeness recordId={id} initial={standings.map((s) => ({ id: s.field.id, standing: s.standing }))} />

      <section className="flex flex-col gap-4">
        <h2 className="font-medium">What&apos;s been recorded</h2>
        {sections.map((section) => {
          const fields = sectionFields(section);
          return (
            <div key={section.id} className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-muted">
                Section {section.number} — {section.title}
              </h3>
              <ul className="flex flex-col gap-1">
                {fields.map((field) => {
                  const rows = data.values.filter((v) => v.field_id === field.id);
                  const standing = standings.find((s) => s.field.id === field.id)!.standing;
                  return (
                    <li key={field.id} className="rounded-md border border-line p-2 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className={rows.length ? "" : "text-faint"}>{field.label}</span>
                        <span className="text-xs text-faint">
                          {field.disclosure !== "open" && `${field.disclosure} · `}
                          {STANDING_LABEL[standing]}
                        </span>
                      </div>
                      {rows.map((row, i) => (
                        <div key={i} className="mt-1 flex flex-col text-muted">
                          <span>{valueText(row, labelOf)}</span>
                          {row.family_action && (
                            <span className="text-muted">What to do: {row.family_action}</span>
                          )}
                          {row.confidence !== "stated" && (
                            <span className="text-xs text-faint">{row.confidence}</span>
                          )}
                        </div>
                      ))}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      {data.notes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Kept, but no field covered it</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {data.notes.map((n) => (
              <li key={n.label} className="rounded-md border border-line p-2">
                <span className="font-medium">{n.label}</span> — {n.value}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">The conversation</h2>
        <p className="text-sm text-muted">
          Everything said, in order. This is someone&apos;s account of their own death; read it as that.
        </p>
        <ol className="flex flex-col gap-2">
          {transcript.map((line, i) => (
            <li key={i} className="rounded-md border border-line p-2 text-sm">
              <span className="text-xs uppercase tracking-wide text-faint">
                {line.phase === "intake" ? "Opening conversation" : line.sitting_title}
                {" · "}
                {line.role === "agent" ? "Interviewer" : line.role}
              </span>
              <p className="mt-1 whitespace-pre-wrap">{line.content}</p>
            </li>
          ))}
          {!transcript.length && <li className="text-sm text-muted">Nothing said yet.</li>}
        </ol>
      </section>
    </main>
  );
}
