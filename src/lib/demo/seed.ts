import { db } from "@/lib/db";
import { sessionTemplate } from "@/lib/content";
import { addDays } from "@/lib/plan/build-plan";
import { todayInMelbourne } from "@/lib/today";
import { disclosureOf, type Persona, type PersonaSitting } from "@/lib/demo/personas";

/*
 * Writing a persona straight into the database.
 *
 * This is the cheap half of demoing: instant, repeatable, and it costs
 * nothing, because no model is involved. It is for showing what the product
 * produces -- the plan, the record, the Guide, the envelope. Showing what the
 * product is like to use still means running the real conversation.
 *
 * Everything goes in through the same columns the agents write, so a seeded
 * record is indistinguishable from a real one downstream: the renderer, the
 * completeness check and the admin view can't tell and don't need to.
 */

/** Clears whatever this account had, so seeding twice is safe. */
export async function clearRecordsFor(userId: string): Promise<void> {
  // records cascades to sittings, messages, entities, values and notes.
  await db()`delete from records where owner_user_id = ${userId}`;
}

function minutesFor(sitting: PersonaSitting): number {
  return sitting.minutes ?? sessionTemplate.sittings.find((s) => s.key === sitting.key)?.base_minutes ?? 15;
}

export interface SeedResult {
  recordId: string;
  sittings: number;
  values: number;
  entities: number;
}

export async function seedPersona(userId: string, persona: Persona): Promise<SeedResult> {
  // A record is written across half a dozen tables and the HTTP driver has no
  // transaction spanning them, so a failure part-way would leave a record that
  // looks seeded and isn't. Clear it and let the caller hear about it rather
  // than leave that lying around to be demoed by accident.
  try {
    return await write(userId, persona);
  } catch (err) {
    await clearRecordsFor(userId).catch(() => {});
    throw err;
  }
}

async function write(userId: string, persona: Persona): Promise<SeedResult> {
  const sql = db();
  const today = todayInMelbourne();

  await clearRecordsFor(userId);

  const [{ id: recordId }] = (await sql`
    insert into records
      (owner_user_id, subject_name, subject_relationship, present, intake, intake_completed_at,
       consent_given_at, consent_note)
    values
      (${userId}, ${persona.subject_name}, ${persona.relationship},
       ${JSON.stringify(persona.present)}::jsonb, ${JSON.stringify(persona.intake ?? {})}::jsonb,
       ${persona.intake_done ? "now()" : null}::timestamptz,
       now(), 'Seeded demo record. Not a real person.')
    returning id`) as { id: string }[];

  // ── The plan ────────────────────────────────────────────────────────
  const bySittingKey = new Map<string, string>();
  let seq = 0;
  for (const sitting of persona.sittings) {
    seq += 1;
    const template = sessionTemplate.sittings.find((s) => s.key === sitting.key);
    const [{ id }] = (await sql`
      insert into sittings
        (record_id, seq, title, covers, estimated_minutes, scheduled_for, sitting_key, status,
         started_at, completed_at)
      values
        (${recordId}, ${seq}, ${template?.title ?? sitting.key}, ${template?.covers ?? []},
         ${minutesFor(sitting)}, ${addDays(today, sitting.day)}::date, ${sitting.key}, ${sitting.status},
         ${sitting.status === "planned" ? null : "now()"}::timestamptz,
         ${sitting.status === "done" ? "now()" : null}::timestamptz)
      returning id`) as { id: string }[];
    bySittingKey.set(sitting.key, id);
  }

  // ── What was said ───────────────────────────────────────────────────
  // Every captured value hangs off a message, which is how capturedIn() and
  // the transcript find it. A persona without a transcript still needs one.
  // A person's message is stored twice over: `content` is what they typed, and
  // the block the model sees is prefixed with their name, because two people
  // share one keyboard. Seeded messages have to carry that prefix too, or a
  // seeded transcript shows no names where a real one does.
  const helper = persona.present.find((name) => name !== persona.subject_name) ?? persona.subject_name;
  const nameOf = (from: string) => (from === "subject" ? persona.subject_name : from === "helper" ? helper : null);

  const messageFor = new Map<string, string>();
  for (const line of persona.transcript ?? []) {
    const sittingId = line.sitting ? (bySittingKey.get(line.sitting) ?? null) : null;
    const text = line.text.trim();
    const speaker = nameOf(line.from);
    const block = speaker ? `${speaker}: ${text}` : text;
    const [{ id }] = (await sql`
      insert into messages (record_id, sitting_id, phase, role, content, blocks)
      values (${recordId}, ${sittingId}, ${sittingId ? "sitting" : "intake"}, ${line.from},
              ${text}, ${JSON.stringify([{ type: "text", text: block }])}::jsonb)
      returning id`) as { id: string }[];
    if (sittingId && line.from === "subject" && !messageFor.has(line.sitting!)) {
      messageFor.set(line.sitting!, id);
    }
  }

  // A sitting whose transcript had nothing from the subject still needs a
  // message for its values to point at.
  for (const [key, sittingId] of bySittingKey) {
    if (messageFor.has(key)) continue;
    const [{ id }] = (await sql`
      insert into messages (record_id, sitting_id, phase, role, content, blocks)
      values (${recordId}, ${sittingId}, 'sitting', 'subject', '(recorded during this sitting)',
              ${JSON.stringify([
                { type: "text", text: `${persona.subject_name}: (recorded during this sitting)` },
              ])}::jsonb)
      returning id`) as { id: string }[];
    messageFor.set(key, id);
  }

  // Which sitting covers a field decides which message its value hangs off,
  // so the live document and the admin view attribute it to the right one.
  const sittingForField = new Map<string, string>();
  for (const template of sessionTemplate.sittings) {
    for (const topic of template.topics) {
      for (const id of topic.covers) sittingForField.set(id, template.key);
    }
  }
  const anySitting = persona.sittings[0]?.key;
  const messageForField = (fieldId: string) =>
    messageFor.get(sittingForField.get(fieldId) ?? anySitting ?? "") ?? null;

  // ── The people, accounts and bills ──────────────────────────────────
  const entityIds = new Map<string, string>();
  for (const entity of persona.entities ?? []) {
    const [{ id }] = (await sql`
      insert into entity_instances (record_id, entity_type, label, data)
      values (${recordId}, ${entity.type}, ${entity.label}, ${JSON.stringify(entity.data ?? {})}::jsonb)
      returning id`) as { id: string }[];
    entityIds.set(entity.label, id);
  }

  // ── What was recorded ───────────────────────────────────────────────
  let values = 0;
  for (const row of persona.record ?? []) {
    const messageId = messageForField(row.field);
    const entityId = row.entity ? (entityIds.get(row.entity) ?? null) : null;

    if (row.unknown) {
      await sql`
        insert into field_values (record_id, field_id, status, disclosure, who_would_know, gap_priority, source_message_id)
        values (${recordId}, ${row.field}, 'unknown', ${disclosureOf(row.field)}, ${row.unknown}, ${row.priority ?? 'medium'}, ${messageId})
        on conflict do nothing`;
      values += 1;
      continue;
    }

    const value = row.amount ? { amount: row.amount } : (row.value ?? null);
    await sql`
      insert into field_values
        (record_id, field_id, entity_instance_id, value, status, disclosure, confidence,
         family_action, source_message_id)
      values
        (${recordId}, ${row.field}, ${entityId}, ${JSON.stringify(value)}::jsonb, 'answered',
         ${disclosureOf(row.field)}, ${row.confidence ?? "stated"}, ${row.action ?? null}, ${messageId})
      on conflict (record_id, field_id, entity_instance_id) do update set
        value = excluded.value,
        family_action = coalesce(excluded.family_action, field_values.family_action)`;
    values += 1;
  }

  for (const note of persona.notes ?? []) {
    await sql`
      insert into overflow_notes (record_id, label, value, family_action, confidence, source_message_id)
      values (${recordId}, ${note.label}, ${note.value}, ${note.action ?? null}, 'stated',
              ${messageForField("")})
      on conflict do nothing`;
  }

  return {
    recordId,
    sittings: persona.sittings.length,
    values,
    entities: entityIds.size,
  };
}
