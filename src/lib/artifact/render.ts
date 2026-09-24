import { artifact, sectionFields, type Field, type Section } from "@/lib/content";
import type { EntityRow, RecordData, ValueRow } from "@/lib/artifact/collect";

// Turning a record into the two printed documents.
//
// This is a renderer, not a writer. Every field is already typed, already in
// template order, and already carries its own disclosure level, so there is
// nothing here for a model to decide -- which means the same record always
// prints the same document, and nothing can appear that nobody said.
//
// The rules below come from docs/Artifact Template.md, and the awkward ones
// are the point: a sealed field must leave a visible marker rather than a
// blank, because a blank reads as "there is nothing here"; and if anything at
// all is sealed the envelope prints, however little is in it.

export interface PrintMeta {
  version: string;
  preparedOn: string;
  envelopeKeptAt?: string;
}

const NOTHING_HERE = "_Nothing recorded yet for this part._";

interface Prepared {
  field: Field;
  rows: ValueRow[];
}

function entityById(data: RecordData): Map<string, EntityRow> {
  return new Map(data.entities.map((e) => [e.id, e]));
}

function prepare(data: RecordData, fields: Field[]): Prepared[] {
  return fields.map((field) => ({
    field,
    rows: data.values.filter((v) => v.field_id === field.id),
  }));
}

function formatEntity(row: ValueRow, entities: Map<string, EntityRow>): string | null {
  const entity = row.entity_instance_id ? entities.get(row.entity_instance_id) : undefined;
  if (!entity) return null;
  const details = Object.entries(entity.data)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`);
  const amount = (row.value as { amount?: string } | null)?.amount;
  if (amount) details.push(`amount: ${amount}`);
  return `**${entity.label}**${details.length ? ` — ${details.join("; ")}` : ""}`;
}

// The field's own type says how a value should read: a sequence is numbered
// because the order carries meaning, everything else is a list or a paragraph.
function formatValue(row: ValueRow, field: Field, entities: Map<string, EntityRow>): string[] {
  if (row.entity_instance_id) {
    const line = formatEntity(row, entities);
    return line ? [`- ${line}`] : [];
  }
  const value = row.value;
  if (Array.isArray(value)) {
    return field.type === "ordered"
      ? value.map((v, i) => `${i + 1}. ${v}`)
      : value.map((v) => `- ${v}`);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function renderRows(prepared: Prepared, entities: Map<string, EntityRow>, sealedMarker: boolean): string[] {
  const { field, rows } = prepared;
  const out: string[] = [];
  const answered = rows.filter((r) => r.status === "answered");
  const gaps = rows.filter((r) => r.status === "unknown");

  const open = answered.filter((r) => r.disclosure !== "sealed");
  const sealed = answered.filter((r) => r.disclosure === "sealed");

  for (const row of open) {
    out.push(...formatValue(row, field, entities));
    if (row.family_action) out.push(`  _What to do: ${row.family_action}_`);
    if (row.confidence === "uncertain") out.push("  _They weren't certain about this._");
  }

  // A marker, never a blank: the family cannot wait for something they don't
  // know exists.
  if (sealed.length && sealedMarker) {
    out.push(
      sealed.length === 1
        ? "- _One item here is in the sealed envelope._"
        : `- _${sealed.length} items here are in the sealed envelope._`,
    );
  }

  // Gaps are content. An unanswered question naming who would know is worth
  // more than a blank.
  for (const gap of gaps) {
    const who = gap.who_would_know ? ` — ${gap.who_would_know} may know.` : " — nobody has been identified who would know.";
    out.push(`- _Not yet known.${who}_`);
  }

  return out;
}

function sectionBlock(
  section: Section,
  data: RecordData,
  entities: Map<string, EntityRow>,
  mode: "guide" | "envelope",
): string[] {
  const fields = sectionFields(section);
  const prepared = prepare(data, fields);

  if (mode === "envelope") {
    const lines: string[] = [];
    for (const item of prepared) {
      const sealed = item.rows.filter((r) => r.status === "answered" && r.disclosure === "sealed");
      if (!sealed.length) continue;
      lines.push(`### ${item.field.label}`, "");
      for (const row of sealed) {
        lines.push(...formatValue(row, item.field, entities));
        if (row.family_action) lines.push(`  _What to do: ${row.family_action}_`);
      }
      lines.push("");
    }
    return lines.length ? [`## Section ${section.number} — ${section.title}`, "", ...lines] : [];
  }

  const lines: string[] = [`## Section ${section.number} — ${section.title}`, ""];
  const anythingOpen = prepared.some((p) =>
    p.rows.some((r) => (r.status === "answered" && r.disclosure !== "sealed") || r.status === "unknown"),
  );
  const anythingSealed = prepared.some((p) => p.rows.some((r) => r.status === "answered" && r.disclosure === "sealed"));

  // A section that is entirely sealed still prints its heading, and says so.
  // A silently missing section is indistinguishable from a life without one.
  if (!anythingOpen && anythingSealed) {
    lines.push("_Everything recorded for this section is in the sealed envelope._", "");
    return lines;
  }

  let printedAnything = false;
  for (const item of prepared) {
    const body = renderRows(item, entities, true);
    if (!body.length) continue;
    printedAnything = true;
    lines.push(`### ${item.field.label}`, "", ...body, "");
  }

  if (!printedAnything) lines.push(NOTHING_HERE, "");
  return lines;
}

function frontMatter(data: RecordData, meta: PrintMeta, title: string, framing: string): string[] {
  const { header } = data;
  return [
    `# ${title}`,
    "",
    `**For:** the people ${header.subject_name} leaves behind.`,
    `**Prepared:** ${meta.preparedOn} · **Version:** ${meta.version}`,
    "",
    framing,
    "",
    "This is a draft prepared from a recorded conversation. It has not been checked by anyone, " +
      "and it is **not a will** — it has no legal effect and decides nothing about anyone's estate.",
    "",
    "---",
    "",
  ];
}

export function hasSealedContent(data: RecordData): boolean {
  return data.values.some((v) => v.status === "answered" && v.disclosure === "sealed");
}

export function renderGuide(data: RecordData, meta: PrintMeta): string {
  const entities = entityById(data);
  const sections = artifact.sections.filter((s) => artifact.scope.includes(s.number));

  const lines = frontMatter(
    data,
    meta,
    "The Guide",
    `What ${data.header.subject_name} wanted the people around them to know: who to call, what exists, ` +
      "where things are, and what must not be missed.",
  );

  for (const section of sections) lines.push(...sectionBlock(section, data, entities, "guide"));

  if (data.notes.length) {
    lines.push("## Also worth knowing", "");
    for (const note of data.notes) {
      lines.push(`- **${note.label}** — ${note.value}`);
      if (note.family_action) lines.push(`  _What to do: ${note.family_action}_`);
    }
    lines.push("");
  }

  // Nobody should spend the worst week of their life looking for an envelope
  // that was never printed.
  lines.push("## The sealed envelope", "");
  lines.push(
    hasSealedContent(data)
      ? `There is a sealed envelope. It is opened only after ${data.header.subject_name} has died.` +
          (meta.envelopeKeptAt ? ` It is kept ${meta.envelopeKeptAt}.` : " Ask where it is kept.")
      : "There is no sealed envelope. Everything recorded is in this document.",
  );
  lines.push("");

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/** Null when nothing is sealed, which is the only case where no envelope prints. */
export function renderEnvelope(data: RecordData, meta: PrintMeta): string | null {
  if (!hasSealedContent(data)) return null;

  const entities = entityById(data);
  const sections = artifact.sections.filter((s) => artifact.scope.includes(s.number));

  // The envelope has to stand on its own: it may be opened months later with
  // the Guide nowhere to hand.
  const lines = frontMatter(
    data,
    meta,
    "The Sealed Envelope",
    `This belongs with ${data.header.subject_name}'s Guide. It holds what they were willing to write ` +
      "down but not to leave lying about. It is opened only after they have died.",
  );

  for (const section of sections) lines.push(...sectionBlock(section, data, entities, "envelope"));

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
