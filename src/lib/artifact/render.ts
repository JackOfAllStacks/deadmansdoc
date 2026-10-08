import { documentSections, sectionFields, type DocumentSection, type Field } from "@/lib/content";
import type { EntityRow, RecordData, ValueRow } from "@/lib/artifact/collect";
import { toMarkdown, type Doc, type DocPart, type DocSection, type Entry } from "@/lib/artifact/doc";

// Turning a record into the two documents.
//
// This is a renderer, not a writer. Every field is already typed, already in
// template order, and already carries its own disclosure level, so there is
// nothing here for a model to decide -- which means the same record always
// produces the same document, and nothing can appear that nobody said.
//
// The rules below come from docs/Artifact Template.md, and the awkward ones
// are the point: a sealed field must leave a visible marker rather than a
// blank, because a blank reads as "there is nothing here"; and if anything at
// all is sealed the envelope prints, however little is in it.
//
// What those rules produce is a Doc (doc.ts). Markdown is one way of writing
// a Doc out; the page someone reads is another. Written once, so the printed
// document and the one on screen cannot disagree.

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
    // The label already is the name; repeating it as a detail reads as a
    // stutter -- "Robyn — name: Robyn; contact: ...".
    .filter(([k, v]) => v && k !== "name")
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`);
  const amount = (row.value as { amount?: string } | null)?.amount;
  if (amount) details.push(`amount: ${amount}`);
  return `**${entity.label}**${details.length ? ` — ${details.join("; ")}` : ""}`;
}

// The field's own type says how a value should read: a sequence is numbered
// because the order carries meaning, everything else is a list or a paragraph.
function valueEntry(row: ValueRow, field: Field, entities: Map<string, EntityRow>): Entry | null {
  const asides: string[] = [];
  if (row.family_action) asides.push(`What to do: ${row.family_action}`);
  if (row.confidence === "uncertain") asides.push("They weren't certain about this.");

  if (row.entity_instance_id) {
    const line = formatEntity(row, entities);
    return line ? { lines: [line], shape: "bullets", asides } : null;
  }

  const value = row.value;
  if (Array.isArray(value)) {
    const lines = value.map(String);
    return lines.length ? { lines, shape: field.type === "ordered" ? "steps" : "bullets", asides } : null;
  }
  if (typeof value === "string" && value.trim()) {
    return { lines: [value.trim()], shape: "para", asides };
  }
  return null;
}

function fieldEntries(prepared: Prepared, entities: Map<string, EntityRow>, sealedMarker: boolean): Entry[] {
  const { field, rows } = prepared;
  const out: Entry[] = [];
  const answered = rows.filter((r) => r.status === "answered");
  const gaps = rows.filter((r) => r.status === "unknown");

  const open = answered.filter((r) => r.disclosure !== "sealed");
  const sealed = answered.filter((r) => r.disclosure === "sealed");

  for (const row of open) {
    const entry = valueEntry(row, field, entities);
    if (entry) out.push(entry);
  }

  // A marker, never a blank: the family cannot wait for something they don't
  // know exists.
  if (sealed.length && sealedMarker) {
    out.push({
      lines: [
        sealed.length === 1
          ? "_One item here is in the sealed envelope._"
          : `_${sealed.length} items here are in the sealed envelope._`,
      ],
      shape: "bullets",
      asides: [],
    });
  }

  // Gaps are content. An unanswered question naming who would know is worth
  // more than a blank.
  for (const gap of gaps) {
    const who = gap.who_would_know
      ? ` — ${gap.who_would_know} may know.`
      : " — nobody has been identified who would know.";
    out.push({ lines: [`_Not yet known.${who}_`], shape: "bullets", asides: [] });
  }

  return out;
}

function sealedEntries(prepared: Prepared, entities: Map<string, EntityRow>): Entry[] {
  return prepared.rows
    .filter((r) => r.status === "answered" && r.disclosure === "sealed")
    .map((row) => valueEntry(row, prepared.field, entities))
    .filter((e): e is Entry => e !== null)
    // The envelope says what to do with a figure, but never how sure they were:
    // that belongs with the thing itself, in the Guide.
    .map((entry) => ({ ...entry, asides: entry.asides.filter((a) => a.startsWith("What to do:")) }));
}

function guideSection(section: DocumentSection, data: RecordData, entities: Map<string, EntityRow>): DocSection {
  const prepared = prepare(data, sectionFields(section));
  const heading = `Section ${section.place} — ${section.title}`;

  const anythingOpen = prepared.some((p) =>
    p.rows.some((r) => (r.status === "answered" && r.disclosure !== "sealed") || r.status === "unknown"),
  );
  const anythingSealed = prepared.some((p) => p.rows.some((r) => r.status === "answered" && r.disclosure === "sealed"));

  // A section that is entirely sealed still prints its heading, and says so.
  // A silently missing section is indistinguishable from a life without one.
  if (!anythingOpen && anythingSealed) {
    return { heading, note: "_Everything recorded for this section is in the sealed envelope._", parts: [] };
  }

  const parts: DocPart[] = [];
  for (const item of prepared) {
    const entries = fieldEntries(item, entities, true);
    if (entries.length) parts.push({ heading: item.field.label, entries });
  }

  return parts.length ? { heading, parts } : { heading, note: NOTHING_HERE, parts: [] };
}

function envelopeSection(section: DocumentSection, data: RecordData, entities: Map<string, EntityRow>): DocSection | null {
  const parts: DocPart[] = [];
  for (const item of prepare(data, sectionFields(section))) {
    const entries = sealedEntries(item, entities);
    if (entries.length) parts.push({ heading: item.field.label, entries });
  }
  return parts.length ? { heading: `Section ${section.place} — ${section.title}`, parts } : null;
}

const inScope = () => documentSections;

const DISCLAIMER =
  "This is a draft prepared from a recorded conversation. It has not been checked by anyone, " +
  "and it is **not a will** — it has no legal effect and decides nothing about anyone's estate.";

export function hasSealedContent(data: RecordData): boolean {
  return data.values.some((v) => v.status === "answered" && v.disclosure === "sealed");
}

export function guideDoc(data: RecordData, meta: PrintMeta): Doc {
  const entities = entityById(data);
  const sections = inScope().map((section) => guideSection(section, data, entities));

  if (data.notes.length) {
    sections.push({
      heading: "Also worth knowing",
      parts: [
        {
          entries: data.notes.map((note) => ({
            lines: [`**${note.label}** — ${note.value}`],
            shape: "bullets" as const,
            asides: note.family_action ? [`What to do: ${note.family_action}`] : [],
          })),
        },
      ],
    });
  }

  // Nobody should spend the worst week of their life looking for an envelope
  // that was never printed.
  sections.push({
    heading: "The sealed envelope",
    note: hasSealedContent(data)
      ? `There is a sealed envelope. It is opened only after ${data.header.subject_name} has died.` +
        (meta.envelopeKeptAt ? ` It is kept ${meta.envelopeKeptAt}.` : " Ask where it is kept.")
      : "There is no sealed envelope. Everything recorded is in this document.",
    parts: [],
  });

  return {
    title: "The Guide",
    forWhom: `the people ${data.header.subject_name} leaves behind.`,
    prepared: meta.preparedOn,
    version: meta.version,
    framing:
      `What ${data.header.subject_name} wanted the people around them to know: who to call, what exists, ` +
      "where things are, and what must not be missed.",
    disclaimer: DISCLAIMER,
    sections,
  };
}

/** Null when nothing is sealed, which is the only case where no envelope prints. */
export function envelopeDoc(data: RecordData, meta: PrintMeta): Doc | null {
  if (!hasSealedContent(data)) return null;
  const entities = entityById(data);

  return {
    title: "The Sealed Envelope",
    forWhom: `the people ${data.header.subject_name} leaves behind.`,
    prepared: meta.preparedOn,
    version: meta.version,
    // The envelope has to stand on its own: it may be opened months later with
    // the Guide nowhere to hand.
    framing:
      `This belongs with ${data.header.subject_name}'s Guide. It holds what they were willing to write ` +
      "down but not to leave lying about. It is opened only after they have died.",
    disclaimer: DISCLAIMER,
    sections: inScope()
      .map((section) => envelopeSection(section, data, entities))
      .filter((s): s is DocSection => s !== null),
  };
}

export function renderGuide(data: RecordData, meta: PrintMeta): string {
  return toMarkdown(guideDoc(data, meta));
}

export function renderEnvelope(data: RecordData, meta: PrintMeta): string | null {
  const doc = envelopeDoc(data, meta);
  return doc ? toMarkdown(doc) : null;
}
