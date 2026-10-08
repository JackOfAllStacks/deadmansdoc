"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldsById, sessionTemplate } from "@/lib/content";
import { DEMO_RUN_COOKIE } from "@/lib/demo/run";
import { addDays, buildPlan, isIsoDate, reorderSlots, RHYTHMS, type Rhythm } from "@/lib/plan/build-plan";
import {
  applyRevision,
  createRecord,
  getRecordForUser,
  listSittings,
  reassignSpeaker,
  reopenIntake,
  rescheduleSitting,
  savePlan,
  speakersFor,
} from "@/lib/records";
import { requireSession } from "@/lib/session";
import { applyFieldEdit } from "@/lib/sitting/apply-edit";
import { knownEntities, routeGap } from "@/lib/sitting/capture";
import { openSitting, startSitting } from "@/lib/sitting/store";
import { todayInMelbourne } from "@/lib/today";

export type FormState = { error?: string; ok?: boolean };

const MAX_PRESENT = 6;
const MAX_DAYS_AHEAD = 365;

const startSchema = z.object({
  relationship: z.enum(["self", "parent", "other"], { error: "Choose who this record is for." }),
  subjectName: z.string().trim().min(1, "Add their first name.").max(60, "That name is too long."),
  present: z.string().max(400),
  notAWill: z.literal("on", { error: "Please confirm you understand this isn't a will." }),
  consent: z.literal("on", { error: "Please confirm you're happy to begin." }),
});

export async function startRecord(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const parsed = startSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { relationship, present: presentText } = parsed.data;
  const subjectName = relationship === "self" ? user.name : parsed.data.subjectName;
  const present = [
    ...new Set(
      presentText
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ];
  if (!present.length) return { error: "Add at least one name for who's here today." };
  if (present.length > MAX_PRESENT) return { error: `List up to ${MAX_PRESENT} people.` };
  if (present.some((name) => name.length > 60)) return { error: "One of those names is too long." };

  await createRecord(user.id, { subjectName, relationship, present });
  redirect("/start/intake");
}

function checkDate(date: string): string | null {
  const today = todayInMelbourne();
  if (!isIsoDate(date)) return "Choose a date.";
  if (date < today) return "Choose a date from today onwards.";
  if (date > addDays(today, MAX_DAYS_AHEAD)) return "Choose a date within the next year.";
  return null;
}

export async function confirmPlan(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const record = await getRecordForUser(user.id);
  if (!record?.intake_completed_at) redirect("/home");

  const startDate = String(form.get("startDate") ?? "");
  const rhythm = String(form.get("rhythm") ?? "");
  const dateProblem = checkDate(startDate);
  if (dateProblem) return { error: dateProblem };
  if (!(rhythm in RHYTHMS)) return { error: "Choose how often you'd like to meet." };

  const plan = buildPlan(record.intake, sessionTemplate, { startDate, rhythm: rhythm as Rhythm });
  await savePlan(record.id, plan);
  redirect("/plan");
}

// Dates on the plan are a suggestion, not a gate: any planned sitting can be
// started whenever suits. Only one runs at a time, which startSitting enforces.
export async function beginSitting(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const record = await getRecordForUser(user.id);
  if (!record) redirect("/home");

  const sittingId = z.uuid().safeParse(form.get("sittingId"));
  if (!sittingId.success) return { error: "Something went wrong. Please reload the page." };

  const started = await startSitting(record.id, sittingId.data, record.present);
  if (!started) {
    const open = await openSitting(record.id);
    return {
      error: open
        ? `“${open.title}” is still open. Carry on with that one first.`
        : "That sitting can't be started now.",
    };
  }
  redirect("/sitting");
}

export async function moveSitting(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const record = await getRecordForUser(user.id);
  if (!record) redirect("/home");

  const sittingId = z.uuid().safeParse(form.get("sittingId"));
  const date = String(form.get("date") ?? "");
  if (!sittingId.success) return { error: "Something went wrong. Please reload the page." };
  const dateProblem = checkDate(date);
  if (dateProblem) return { error: dateProblem };

  const moved = await rescheduleSitting(record.id, sittingId.data, date);
  if (!moved) return { error: "That sitting can't be moved now." };
  revalidatePath("/plan");
  return { ok: true };
}

/**
 * Goes back into the opening conversation after it finished. Finishing it
 * again re-cuts whichever sittings haven't been started; see reviseRemaining.
 */
export async function reopenConversation(): Promise<FormState> {
  const { user } = await requireSession();
  const record = await getRecordForUser(user.id);
  if (!record) redirect("/home");

  if (!(await reopenIntake(record.id))) {
    return { error: "Finish the sitting that's open first, then come back to this." };
  }
  revalidatePath("/start/intake");
  return { ok: true };
}

/**
 * Files a message under a different person. Correcting it afterwards is the
 * point: the speaker control can be left on the wrong name for a whole turn
 * without anybody noticing, and a record that says the wrong person said
 * something is worse than one that has to be put right.
 */
export async function correctSpeaker(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const record = await getRecordForUser(user.id);
  if (!record) redirect("/home");

  const messageId = z.uuid().safeParse(form.get("messageId"));
  const speaker = String(form.get("speaker") ?? "");
  if (!messageId.success) return { error: "Something went wrong. Please reload the page." };
  if (!speakersFor(record).includes(speaker)) return { error: "That isn't one of the people here." };

  const moved = await reassignSpeaker(record.id, messageId.data, speaker, speaker === record.subject_name);
  if (!moved) return { error: "That message can't be moved." };
  return { ok: true };
}

/**
 * Reordering the plan by hand. The sittings move between the slots they
 * already occupy, so the dates someone has arranged their month around stay
 * where they are; see reorderSlots.
 */
export async function reorderPlan(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const record = await getRecordForUser(user.id);
  if (!record) redirect("/home");

  const order = z.array(z.uuid()).max(20).safeParse(JSON.parse(String(form.get("order") ?? "null")));
  if (!order.success) return { error: "Something went wrong. Please reload the page." };

  const sittings = await listSittings(record.id);
  const moves = reorderSlots(sittings, order.data);
  // An order that isn't exactly the sittings nobody has started moves nothing:
  // usually a page left open while a sitting was begun in another tab.
  if (!moves.length) return { error: "The plan has changed since this page loaded. Reload and try again." };

  await applyRevision(record.id, moves);
  revalidatePath("/plan");
  revalidatePath("/home");
  return { ok: true };
}

/*
 * Closing a loose end.
 *
 * A gap is the one thing in the record that asks something of the person
 * afterwards, so these two are what the loose ends page is for: putting an
 * answer in, or naming who could give one.
 */

const looseEndSchema = z.object({
  fieldId: z.string().trim().min(1).max(120),
  body: z.string().max(10_000),
});

/** Writes an answer over a gap, through the same path a hand edit in a sitting takes. */
export async function answerLooseEnd(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const record = await getRecordForUser(user.id);
  if (!record) redirect("/home");

  const parsed = looseEndSchema.safeParse({ fieldId: form.get("fieldId"), body: form.get("body") });
  if (!parsed.success) return { error: "Something went wrong. Please reload the page." };

  const field = fieldsById.get(parsed.data.fieldId);
  if (!field) return { error: "Something went wrong. Please reload the page." };
  // An entry with its own details -- an account, a bill, a person -- is more
  // than a box can honestly take, and the sitting that covers it asks the
  // questions that go with it.
  if (field.type === "entities") {
    return { error: "This one is a list of entries, so it belongs in the sitting that covers it." };
  }
  // An empty box would parse as "clear this field", which would delete the
  // gap rather than answer it -- and a gap is content, not a blank.
  if (!parsed.data.body.trim()) return { error: "Nothing was typed in." };

  const result = await applyFieldEdit({
    recordId: record.id,
    field,
    body: parsed.data.body,
    known: await knownEntities(record.id),
    // Typed in outside a sitting, so there is no message behind it. The value
    // still carries its own confidence, which is what a reader needs.
    messageId: async () => null,
  });
  if (!result.ok) return { error: result.message };

  revalidatePath("/loose-ends");
  revalidatePath("/home");
  revalidatePath("/guide");
  return { ok: true };
}

/**
 * Names who might know. Deliberately not restricted to the people already in
 * the record: this is a note to whoever reads the Guide, not a reference the
 * document resolves, and "the solicitor" is a perfectly good answer. Where the
 * name does match somebody recorded, their recorded spelling wins, so one
 * person doesn't become two errands.
 */
export async function routeLooseEnd(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const record = await getRecordForUser(user.id);
  if (!record) redirect("/home");

  const fieldId = z.string().trim().min(1).max(120).safeParse(form.get("fieldId"));
  const who = String(form.get("who") ?? "").trim();
  if (!fieldId.success || !fieldsById.has(fieldId.data)) {
    return { error: "Something went wrong. Please reload the page." };
  }
  if (!who) return { error: "Add a name, or leave it for now." };
  if (who.length > 80) return { error: "That name is too long." };

  const known = await knownEntities(record.id);
  const match = known.find((k) => k.entityType === "person" && k.label.toLowerCase() === who.toLowerCase());

  if (!(await routeGap(record.id, fieldId.data, match ? match.label : who))) {
    return { error: "That one has been answered since this page loaded. Reload to see it." };
  }

  revalidatePath("/loose-ends");
  revalidatePath("/guide");
  return { ok: true };
}

/** The end of a demo run, whether it finished or somebody stopped it. */
export async function endDemoRun(): Promise<void> {
  await requireSession();
  (await cookies()).delete(DEMO_RUN_COOKIE);
}
