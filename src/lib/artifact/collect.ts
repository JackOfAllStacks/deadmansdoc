import { db } from "@/lib/db";
import type { Disclosure } from "@/lib/content";

// Everything one record holds, in the shape the renderer and the completeness
// check both want. One query per table rather than a join, because a field can
// have many entities hanging off it and flattening that in SQL only has to be
// unflattened again.

export interface ValueRow {
  field_id: string;
  entity_instance_id: string | null;
  value: unknown;
  status: "answered" | "unknown" | "skipped";
  disclosure: Disclosure;
  confidence: "stated" | "uncertain" | "inferred";
  family_action: string | null;
  who_would_know: string | null;
  gap_priority: "high" | "medium" | "low" | null;
}

export interface EntityRow {
  id: string;
  entity_type: string;
  label: string;
  data: Record<string, string>;
}

export interface NoteRow {
  label: string;
  value: string;
  family_action: string | null;
  confidence: string;
}

export interface TranscriptLine {
  phase: "intake" | "sitting";
  sitting_title: string | null;
  role: string;
  content: string;
}

export interface RecordHeader {
  id: string;
  subject_name: string;
  subject_relationship: "self" | "parent" | "other";
  present: string[];
  intake: { summary?: string } | null;
  intake_completed_at: string | null;
  created_at: string;
  owner_email: string;
}

export interface RecordData {
  header: RecordHeader;
  values: ValueRow[];
  entities: EntityRow[];
  notes: NoteRow[];
}

export async function getRecordHeader(recordId: string): Promise<RecordHeader | null> {
  const rows = await db()`
    select r.id, r.subject_name, r.subject_relationship, r.present, r.intake, r.intake_completed_at,
           r.created_at, u.email as owner_email
    from records r
    join "user" u on u.id = r.owner_user_id
    where r.id = ${recordId}`;
  return (rows[0] as RecordHeader | undefined) ?? null;
}

export async function collectRecord(recordId: string): Promise<RecordData | null> {
  const header = await getRecordHeader(recordId);
  if (!header) return null;

  const [values, entities, notes] = await Promise.all([
    db()`
      select field_id, entity_instance_id, value, status, disclosure, confidence,
             family_action, who_would_know, gap_priority
      from field_values where record_id = ${recordId} order by updated_at`,
    db()`
      select id, entity_type, label, data from entity_instances
      where record_id = ${recordId} order by created_at`,
    db()`
      select label, value, family_action, confidence from overflow_notes
      where record_id = ${recordId} order by created_at`,
  ]);

  return {
    header,
    values: values as ValueRow[],
    entities: entities as EntityRow[],
    notes: notes as NoteRow[],
  };
}

export async function getTranscript(recordId: string): Promise<TranscriptLine[]> {
  const rows = await db()`
    select m.phase, s.title as sitting_title, m.role, m.content
    from messages m
    left join sittings s on s.id = m.sitting_id
    where m.record_id = ${recordId} and m.role <> 'tool' and m.content <> ''
    order by m.position`;
  return rows as TranscriptLine[];
}
