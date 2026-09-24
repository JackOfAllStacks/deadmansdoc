import type Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import type { Signals } from "@/lib/intake/signals";
import type { PlannedSitting, Revision } from "@/lib/plan/build-plan";

// Every function here takes a record id the server looked up from the
// signed-in user (getRecordForUser), never one sent by the browser. That is
// what keeps one account out of another's record.

export type Relationship = "self" | "parent" | "other";

export interface RecordRow {
  id: string;
  owner_user_id: string;
  subject_name: string;
  subject_relationship: Relationship;
  intake: Signals;
  intake_completed_at: string | null;
  present: string[];
}

export async function getRecordForUser(userId: string): Promise<RecordRow | null> {
  const rows = await db()`
    select id, owner_user_id, subject_name, subject_relationship, intake, intake_completed_at, present
    from records
    where owner_user_id = ${userId}
    order by created_at
    limit 1`;
  return (rows[0] as RecordRow | undefined) ?? null;
}

// One record per account for now; a second submit is a no-op.
export async function createRecord(
  userId: string,
  input: { subjectName: string; relationship: Relationship; present: string[] },
): Promise<void> {
  await db()`
    insert into records (owner_user_id, subject_name, subject_relationship, present, consent_given_at, consent_note)
    select ${userId}, ${input.subjectName}, ${input.relationship}, ${JSON.stringify(input.present)}::jsonb, now(),
      'Acknowledged this is not a will and has no legal effect; agreed to begin.'
    where not exists (select 1 from records where owner_user_id = ${userId})`;
}

// The people who can be typing during the conversation: the subject first.
export function speakersFor(record: RecordRow): string[] {
  return [record.subject_name, ...record.present.filter((name) => name !== record.subject_name)];
}

export type MessageRole = "agent" | "subject" | "helper" | "tool";

export interface MessageRow {
  role: MessageRole;
  content: string;
  blocks: Anthropic.Beta.BetaContentBlockParam[];
}

export async function intakeMessages(recordId: string): Promise<MessageRow[]> {
  const rows = await db()`
    select role, content, blocks
    from messages
    where record_id = ${recordId} and phase = 'intake'
    order by position`;
  return rows as MessageRow[];
}

export async function appendIntakeMessage(recordId: string, message: MessageRow): Promise<void> {
  await db()`
    insert into messages (record_id, phase, role, content, blocks)
    values (${recordId}, 'intake', ${message.role}, ${message.content}, ${JSON.stringify(message.blocks)}::jsonb)`;
}

export async function saveIntakeSignals(recordId: string, signals: Signals): Promise<void> {
  await db()`update records set intake = ${JSON.stringify(signals)}::jsonb, updated_at = now() where id = ${recordId}`;
}

export async function completeIntake(recordId: string, signals: Signals): Promise<void> {
  await db()`
    update records
    set intake = ${JSON.stringify(signals)}::jsonb, intake_completed_at = coalesce(intake_completed_at, now()), updated_at = now()
    where id = ${recordId}`;
}

// Only one reply is generated at a time per record. The lock expires on its
// own in case a request dies without releasing it.
export async function acquireIntakeLock(recordId: string): Promise<boolean> {
  const rows = await db()`
    update records set intake_busy_until = now() + interval '3 minutes'
    where id = ${recordId}
      and intake_completed_at is null
      and (intake_busy_until is null or intake_busy_until < now())
    returning id`;
  return rows.length === 1;
}

export async function releaseIntakeLock(recordId: string): Promise<void> {
  await db()`update records set intake_busy_until = null where id = ${recordId}`;
}

export interface SittingRow {
  id: string;
  seq: number;
  title: string;
  sitting_key: string;
  estimated_minutes: number;
  scheduled_for: string;
  status: "planned" | "in_progress" | "done" | "skipped";
}

export async function listSittings(recordId: string): Promise<SittingRow[]> {
  const rows = await db()`
    select id, seq, title, sitting_key, estimated_minutes, to_char(scheduled_for, 'YYYY-MM-DD') as scheduled_for, status
    from sittings
    where record_id = ${recordId}
    order by seq`;
  return rows as SittingRow[];
}

// Writes the whole plan in one statement, and only if there isn't one yet,
// so a double-submit can't create two plans.
export async function savePlan(recordId: string, plan: PlannedSitting[]): Promise<void> {
  const rows = plan.map((s, i) => ({
    seq: i + 1,
    title: s.title,
    covers: s.covers,
    minutes: s.minutes,
    date: s.date,
    key: s.key,
  }));
  await db()`
    insert into sittings (record_id, seq, title, covers, estimated_minutes, scheduled_for, sitting_key)
    select ${recordId}, t.seq, t.title, t.covers, t.minutes, t.date::date, t.key
    from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
      as t(seq int, title text, covers text[], minutes int, date text, key text)
    where not exists (select 1 from sittings where record_id = ${recordId})`;
}

/**
 * Lets someone add to the opening conversation after it has finished. Clearing
 * the completion is all it takes: the turn endpoint and the lock both key off
 * it. Refused while a sitting is open, because finishing would then re-cut the
 * plan underneath a conversation already in progress.
 */
export async function reopenIntake(recordId: string): Promise<boolean> {
  const rows = await db()`
    update records set intake_completed_at = null, updated_at = now()
    where id = ${recordId}
      and intake_completed_at is not null
      and not exists (select 1 from sittings where record_id = ${recordId} and status = 'in_progress')
    returning id`;
  return rows.length === 1;
}

/** Applies a revision to the sittings not yet started. See reviseRemaining. */
export async function applyRevision(recordId: string, revisions: Revision[]): Promise<void> {
  if (!revisions.length) return;
  const sql = db();
  // A revision permutes seq among the untouched sittings, and (record_id, seq)
  // is unique, so they're lifted clear of their own numbering first. Both
  // statements go in one transaction, or neither does.
  await sql.transaction([
    sql`update sittings set seq = seq + 1000 where record_id = ${recordId} and status = 'planned'`,
    sql`
      update sittings set
        title = t.title,
        estimated_minutes = t.minutes,
        seq = t.seq,
        scheduled_for = t.date::date,
        updated_at = now()
      from jsonb_to_recordset(${JSON.stringify(revisions)}::jsonb)
        as t(id uuid, title text, minutes int, seq int, date text)
      where sittings.id = t.id
        and sittings.record_id = ${recordId}
        and sittings.status = 'planned'`,
  ]);
}

export async function rescheduleSitting(recordId: string, sittingId: string, date: string): Promise<boolean> {
  const rows = await db()`
    update sittings set scheduled_for = ${date}::date
    where id = ${sittingId} and record_id = ${recordId} and status = 'planned'
    returning id`;
  return rows.length === 1;
}
