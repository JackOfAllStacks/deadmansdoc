import { cache } from "react";
import { getRecordForUser, listSittings, type RecordRow, type SittingRow } from "@/lib/records";
import { openSitting } from "@/lib/sitting/store";
import type { SittingDetail } from "@/lib/sitting/store";

/*
 * Where someone is up to.
 *
 * Until now this was worked out inside /home's redirect and nowhere else,
 * which is why the app read as one corridor: nothing but that redirect knew
 * the shape of the journey. Now the header, the dashboard and the pages
 * themselves all read it from here.
 */

export type Stage =
  /** Signed up, but hasn't said who the record is for. */
  | "no-record"
  /** The opening conversation hasn't finished. */
  | "intake"
  /** The conversation is done; the plan hasn't been set. */
  | "planning"
  /** There's a plan with sittings still to do. */
  | "sittings"
  /** Every sitting is done or skipped. */
  | "complete";

export interface Journey {
  record: RecordRow | null;
  sittings: SittingRow[];
  /** The sitting already under way, if there is one. Only ever one at a time. */
  open: SittingDetail | null;
  /** The next sitting to do, which is the earliest one still planned. */
  next: SittingRow | null;
  done: number;
  stage: Stage;
}

export const journeyFor = cache(async (userId: string): Promise<Journey> => {
  const record = await getRecordForUser(userId);
  if (!record) {
    return { record: null, sittings: [], open: null, next: null, done: 0, stage: "no-record" };
  }

  const [sittings, open] = await Promise.all([listSittings(record.id), openSitting(record.id)]);
  const done = sittings.filter((s) => s.status === "done").length;
  const next = sittings.find((s) => s.status === "planned") ?? null;

  let stage: Stage = "sittings";
  if (!record.intake_completed_at && !sittings.length) stage = "intake";
  else if (!sittings.length) stage = "planning";
  else if (!next && !open) stage = "complete";

  return { record, sittings, open, next, done, stage };
});

/** How the subject is referred to: "Your plan" versus "John's plan". */
export function possessive(record: RecordRow): string {
  return record.subject_relationship === "self" ? "Your" : `${record.subject_name}'s`;
}

export function possessiveLower(record: RecordRow): string {
  return record.subject_relationship === "self" ? "your" : `${record.subject_name}'s`;
}
