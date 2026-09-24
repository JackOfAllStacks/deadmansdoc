import type Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import type { MessageRow } from "@/lib/records";

// Reading and writing one sitting. Every function takes a record id the server
// looked up from the signed-in user, never one sent by the browser.

export interface SittingDetail {
  id: string;
  record_id: string;
  seq: number;
  title: string;
  sitting_key: string;
  covers: string[];
  estimated_minutes: number;
  scheduled_for: string;
  status: "planned" | "in_progress" | "done" | "skipped";
  started_at: string | null;
  summary: string | null;
  present: string[];
  /** Set while a reply is being generated. */
  busy_until: string | null;
}

export function isBusy(sitting: { busy_until: string | null }, now = Date.now()): boolean {
  return sitting.busy_until !== null && new Date(sitting.busy_until).getTime() > now;
}

export async function getSitting(recordId: string, sittingId: string): Promise<SittingDetail | null> {
  const rows = await db()`
    select id, record_id, seq, title, sitting_key, covers, estimated_minutes,
           to_char(scheduled_for, 'YYYY-MM-DD') as scheduled_for, status, started_at, summary, present, busy_until
    from sittings
    where id = ${sittingId} and record_id = ${recordId}`;
  return (rows[0] as SittingDetail | undefined) ?? null;
}

/** The one in progress, if any — only one at a time per record. */
export async function openSitting(recordId: string): Promise<SittingDetail | null> {
  const rows = await db()`
    select id, record_id, seq, title, sitting_key, covers, estimated_minutes,
           to_char(scheduled_for, 'YYYY-MM-DD') as scheduled_for, status, started_at, summary, present, busy_until
    from sittings
    where record_id = ${recordId} and status = 'in_progress'
    order by started_at
    limit 1`;
  return (rows[0] as SittingDetail | undefined) ?? null;
}

/**
 * Marks a planned sitting as under way. Returns false if another one is
 * already open, so two can't run at once, or if this one is already done.
 */
export async function startSitting(recordId: string, sittingId: string, present: string[]): Promise<boolean> {
  const rows = await db()`
    update sittings
    set status = 'in_progress',
        started_at = coalesce(started_at, now()),
        present = ${JSON.stringify(present)}::jsonb
    where id = ${sittingId}
      and record_id = ${recordId}
      and status in ('planned', 'in_progress')
      and not exists (
        select 1 from sittings other
        where other.record_id = ${recordId} and other.status = 'in_progress' and other.id <> ${sittingId}
      )
    returning id`;
  return rows.length === 1;
}

export async function sittingMessages(sittingId: string): Promise<MessageRow[]> {
  const rows = await db()`
    select role, content, blocks
    from messages
    where sitting_id = ${sittingId} and phase = 'sitting'
    order by position`;
  return rows as MessageRow[];
}

/** Returns the new message's id, so captures can point back at what was said. */
export async function appendSittingMessage(
  recordId: string,
  sittingId: string,
  message: MessageRow,
): Promise<string> {
  const rows = await db()`
    insert into messages (record_id, sitting_id, phase, role, content, blocks)
    values (${recordId}, ${sittingId}, 'sitting', ${message.role}, ${message.content},
            ${JSON.stringify(message.blocks)}::jsonb)
    returning id`;
  return (rows[0] as { id: string }).id;
}

export async function acquireSittingLock(sittingId: string): Promise<boolean> {
  const rows = await db()`
    update sittings set busy_until = now() + interval '3 minutes'
    where id = ${sittingId}
      and status = 'in_progress'
      and (busy_until is null or busy_until < now())
    returning id`;
  return rows.length === 1;
}

export async function releaseSittingLock(sittingId: string): Promise<void> {
  await db()`update sittings set busy_until = null where id = ${sittingId}`;
}

export async function completeSitting(recordId: string, sittingId: string, summary: string): Promise<void> {
  await db()`
    update sittings
    set status = 'done', completed_at = now(), summary = ${summary}, busy_until = null
    where id = ${sittingId} and record_id = ${recordId}`;
}

/** Recorded once per question the tools showed was covered, for later tuning. */
export async function recordQuestionAsks(
  recordId: string,
  sittingId: string,
  asks: { questionId: string; outcome: "answered" | "unknown" }[],
): Promise<void> {
  if (!asks.length) return;
  const rows = asks.map((a) => ({ q: a.questionId, o: a.outcome }));
  await db()`
    insert into question_asks (record_id, sitting_id, question_id, outcome)
    select ${recordId}, ${sittingId}, t.q, t.o
    from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as t(q text, o text)`;
}

export type SittingBlocks = Anthropic.Beta.BetaContentBlockParam[];
