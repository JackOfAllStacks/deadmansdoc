import { fieldsById } from "@/lib/content";
import { db } from "@/lib/db";
import { formatEntityText, formatFieldText } from "@/lib/sitting/format";
import type { AmountCapture, EntityCapture, FieldCapture, KnownEntity } from "@/lib/sitting/validate";

// Writing down what a sitting captured.
//
// entity_instances holds an entry's own details -- a person, an account, a
// bill. field_values says which field an entry belongs to, or holds a plain
// answer directly. That split is what lets the same person appear in both the
// key-people list and the advisers list without their details being stored
// twice, and what keeps a sealed figure out of the open list beside it.

export async function knownEntities(recordId: string): Promise<KnownEntity[]> {
  const rows = await db()`
    select id, entity_type, label from entity_instances where record_id = ${recordId} order by created_at`;
  return (rows as { id: string; entity_type: string; label: string }[]).map((r) => ({
    id: r.id,
    entityType: r.entity_type,
    label: r.label,
  }));
}

export async function saveFieldValue(
  recordId: string,
  capture: FieldCapture,
  messageId: string | null,
): Promise<void> {
  await db()`
    insert into field_values
      (record_id, field_id, value, status, disclosure, confidence, family_action, source_message_id)
    values
      (${recordId}, ${capture.fieldId}, ${JSON.stringify(capture.value)}::jsonb, 'answered',
       ${capture.disclosure}, ${capture.confidence}, ${capture.familyAction}, ${messageId})
    on conflict (record_id, field_id, entity_instance_id) do update set
      value = excluded.value,
      status = 'answered',
      disclosure = excluded.disclosure,
      confidence = excluded.confidence,
      family_action = coalesce(excluded.family_action, field_values.family_action),
      source_message_id = excluded.source_message_id,
      -- A gap that's since been answered is no longer a gap.
      who_would_know = null,
      gap_priority = null,
      updated_at = now()`;
}

/** Returns the entity's id, whether it was new or already there. */
export async function saveEntity(recordId: string, capture: EntityCapture, messageId: string | null): Promise<string> {
  // Merging rather than replacing: a later mention usually adds a detail
  // rather than correcting everything already known.
  const rows = await db()`
    insert into entity_instances (record_id, entity_type, label, data)
    values (${recordId}, ${capture.entityType}, ${capture.label}, ${JSON.stringify(capture.data)}::jsonb)
    on conflict (record_id, entity_type, lower(label)) do update set
      data = entity_instances.data || excluded.data,
      label = excluded.label
    returning id`;
  const entityId = (rows[0] as { id: string }).id;

  await db()`
    insert into field_values
      (record_id, field_id, entity_instance_id, value, status, disclosure, confidence, family_action, source_message_id)
    values
      (${recordId}, ${capture.fieldId}, ${entityId}, '{}'::jsonb, 'answered',
       ${"open"}, ${capture.confidence}, ${capture.familyAction}, ${messageId})
    on conflict (record_id, field_id, entity_instance_id) do update set
      confidence = excluded.confidence,
      family_action = coalesce(excluded.family_action, field_values.family_action),
      source_message_id = excluded.source_message_id,
      updated_at = now()`;

  return entityId;
}

// A direct correction to an entry that already exists: unlike saveEntity,
// this targets a specific row by id rather than upserting by label, so
// renaming "Jordon" to "Jordan" fixes the entry in place instead of quietly
// creating a second one. Attributes merge the same way saveEntity's do; an
// edit that leaves a key out doesn't clear it.
export async function updateEntity(
  recordId: string,
  entityId: string,
  capture: EntityCapture,
  messageId: string | null,
): Promise<void> {
  await db()`
    update entity_instances
    set label = ${capture.label}, data = data || ${JSON.stringify(capture.data)}::jsonb
    where id = ${entityId} and record_id = ${recordId}`;

  await db()`
    update field_values
    set confidence = ${capture.confidence},
        family_action = coalesce(${capture.familyAction}, family_action),
        source_message_id = ${messageId},
        updated_at = now()
    where record_id = ${recordId} and field_id = ${capture.fieldId} and entity_instance_id = ${entityId}`;
}

/** The merged attributes an entity holds right now, for handing back to an editor. */
export async function entityData(recordId: string, entityId: string): Promise<Record<string, string>> {
  const rows = await db()`
    select data from entity_instances where id = ${entityId} and record_id = ${recordId}`;
  return (rows[0] as { data: Record<string, string> } | undefined)?.data ?? {};
}

export async function saveAmount(recordId: string, capture: AmountCapture, messageId: string | null): Promise<void> {
  await db()`
    insert into field_values
      (record_id, field_id, entity_instance_id, value, status, disclosure, confidence, source_message_id)
    values
      (${recordId}, ${capture.fieldId}, ${capture.entityId}, ${JSON.stringify({ amount: capture.amount })}::jsonb,
       'answered', 'sealed', ${capture.confidence}, ${messageId})
    on conflict (record_id, field_id, entity_instance_id) do update set
      value = excluded.value,
      confidence = excluded.confidence,
      source_message_id = excluded.source_message_id,
      updated_at = now()`;
}

export interface GapCapture {
  fieldId: string;
  whoWouldKnow: string | null;
  priority: string;
  note: string | null;
}

// A gap never overwrites an answer: if the field is already filled, an "I'm
// not sure" about some other part of it isn't news. Returns whether it was
// actually recorded, so nothing claims to have written down what it didn't.
export async function saveGap(recordId: string, gap: GapCapture, messageId: string | null): Promise<boolean> {
  const rows = await db()`
    insert into field_values
      (record_id, field_id, value, status, disclosure, who_would_know, gap_priority, source_message_id)
    values
      (${recordId}, ${gap.fieldId}, ${JSON.stringify(gap.note)}::jsonb, 'unknown', 'open',
       ${gap.whoWouldKnow}, ${gap.priority}, ${messageId})
    on conflict (record_id, field_id, entity_instance_id) do update set
      who_would_know = coalesce(excluded.who_would_know, field_values.who_would_know),
      gap_priority = excluded.gap_priority,
      updated_at = now()
    where field_values.status = 'unknown'
    returning id`;
  return rows.length === 1;
}

export interface NoteCapture {
  label: string;
  value: string;
  familyAction: string | null;
  confidence: string;
}

export async function saveNote(
  recordId: string,
  sittingId: string,
  note: NoteCapture,
  messageId: string | null,
): Promise<void> {
  await db()`
    insert into overflow_notes (record_id, sitting_id, label, value, family_action, confidence, source_message_id)
    values (${recordId}, ${sittingId}, ${note.label}, ${note.value}, ${note.familyAction}, ${note.confidence}, ${messageId})
    on conflict (record_id, label) do update set
      value = excluded.value,
      family_action = coalesce(excluded.family_action, overflow_notes.family_action),
      confidence = excluded.confidence,
      source_message_id = excluded.source_message_id,
      updated_at = now()`;
}

export interface FilledField {
  field_id: string;
  status: "answered" | "unknown" | "skipped";
}

export interface CapturedItem {
  kind: "field" | "entity" | "amount" | "gap" | "note";
  label: string;
  detail: string | null;
  /** Which document field this belongs under; null for a free-form note. */
  fieldId: string | null;
  /** The entity this entry is, or is about; null for a plain field, gap or note. */
  entityId: string | null;
  /** The substantive content, formatted for display. Never set for a sealed amount. */
  text: string | null;
  /** An entity's raw attributes, for prefilling an edit form. Set only for kind "entity". */
  attributes: Record<string, string> | null;
}

// What this sitting has written down, for the panel beside the conversation
// after a reload. Which sitting a value came from is traced through the message
// it was drawn from, so nothing has to be denormalised onto field_values.
export async function capturedIn(sittingId: string): Promise<CapturedItem[]> {
  const rows = await db()`
    select
      case
        when fv.status = 'unknown' then 'gap'
        when fv.disclosure = 'sealed' and fv.entity_instance_id is not null then 'amount'
        when fv.entity_instance_id is not null then 'entity'
        else 'field'
      end                                             as kind,
      coalesce(ei.label, fv.field_id)                 as label,
      coalesce(fv.who_would_know, fv.family_action)   as detail,
      fv.field_id                                     as field_id,
      fv.value                                        as value,
      ei.id                                            as entity_id,
      ei.data                                         as entity_data,
      -- An entry keeps the place it was first recorded in. Ordering by the
      -- message alone would shuffle the document every time something was
      -- corrected, because a correction points the row at a newer message.
      coalesce(ei.created_at, m.created_at)           as sort_at,
      m.position                                      as position
    from field_values fv
    join messages m on m.id = fv.source_message_id
    left join entity_instances ei on ei.id = fv.entity_instance_id
    where m.sitting_id = ${sittingId}
    union all
    select 'note', n.label, n.family_action, null, to_jsonb(n.value), null, null, m.created_at, m.position
    from overflow_notes n
    join messages m on m.id = n.source_message_id
    where m.sitting_id = ${sittingId}
    order by sort_at, position`;
  type Row = {
    kind: CapturedItem["kind"];
    label: string;
    detail: string | null;
    field_id: string | null;
    value: unknown;
    entity_id: string | null;
    entity_data: Record<string, string> | null;
  };
  return (rows as Row[]).map((r) => ({
    kind: r.kind,
    // Entities carry their own name; everything else is shown by what the
    // field is called, not its id.
    label: r.field_id && (r.kind === "field" || r.kind === "gap")
      ? (fieldsById.get(r.field_id)?.label ?? r.label)
      : r.label,
    detail: r.detail,
    fieldId: r.field_id,
    entityId: r.entity_id,
    attributes: r.kind === "entity" ? (r.entity_data ?? {}) : null,
    text:
      r.kind === "amount"
        ? null
        : r.kind === "entity"
          ? formatEntityText(r.entity_data)
          : r.kind === "note"
            ? formatFieldText(r.value)
            : r.kind === "field"
              ? formatFieldText(r.value)
              : null,
  }));
}

export async function filledFields(recordId: string): Promise<FilledField[]> {
  const rows = await db()`
    select distinct field_id, status from field_values where record_id = ${recordId}`;
  return rows as FilledField[];
}
