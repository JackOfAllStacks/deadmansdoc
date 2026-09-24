"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sessionTemplate } from "@/lib/content";
import { addDays, buildPlan, isIsoDate, RHYTHMS, type Rhythm } from "@/lib/plan/build-plan";
import { createRecord, getRecordForUser, rescheduleSitting, savePlan } from "@/lib/records";
import { requireSession } from "@/lib/session";
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
