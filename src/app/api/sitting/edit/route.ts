import { z } from "zod";
import { fieldsById } from "@/lib/content";
import { logFailure } from "@/lib/errors";
import { getRecordForUser } from "@/lib/records";
import { getSession } from "@/lib/session";
import { applyFieldEdit } from "@/lib/sitting/apply-edit";
import {
  capturedIn,
  deleteNote,
  filledFields,
  knownEntities,
  saveNote,
} from "@/lib/sitting/capture";
import { coverageOf, sittingFields } from "@/lib/sitting/coverage";
import { documentOutline, looseNotes } from "@/lib/sitting/document";
import { appendSittingMessage, openSitting } from "@/lib/sitting/store";

// Editing the document directly. One field's body arrives as the same text it
// was shown as, and is parsed back through the schemas and validators a tool
// call goes through -- see apply-edit.ts, which the loose ends page shares.
//
// The response is read back out of the database rather than assembled from
// what was just sent, so what lands on screen is what was really stored.

const bodySchema = z.union([
  z.object({ field_id: z.string(), body: z.string().max(10_000) }).strict(),
  z.object({ note_label: z.string(), body: z.string().max(10_000) }).strict(),
]);

const fail = (status: number, message: string) => Response.json({ error: message }, { status });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail(401, "Please sign in again.");

  const record = await getRecordForUser(session.user.id);
  if (!record) return fail(404, "Start a record first.");

  const sitting = await openSitting(record.id);
  if (!sitting) return fail(409, "No sitting is open. Start one from your plan.");

  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return fail(400, "That edit didn't match what was expected.");
  const input = parsedBody.data;

  const reply = async () => {
    const captured = await capturedIn(sitting.id);
    return Response.json({
      outline: documentOutline(sitting.covers, captured),
      notes: looseNotes(captured),
      progress: coverageOf(sitting.covers, await filledFields(record.id)),
      people: (await knownEntities(record.id)).filter((e) => e.entityType === "person").map((e) => e.label),
    });
  };

  try {
    // ── A loose note ──────────────────────────────────────────────────
    if ("note_label" in input) {
      const text = input.body.trim();
      if (!text) {
        await deleteNote(record.id, input.note_label);
        return reply();
      }
      const messageId = await appendSittingMessage(record.id, sitting.id, {
        role: "tool",
        content: `Edited: ${input.note_label}`,
        blocks: [],
      });
      await saveNote(
        record.id,
        sitting.id,
        { label: input.note_label, value: text, familyAction: null, confidence: "stated" },
        messageId,
      );
      return reply();
    }

    // ── One field's body ──────────────────────────────────────────────
    const field = fieldsById.get(input.field_id);
    if (!field || !sittingFields(sitting.covers).some((f) => f.id === field.id)) {
      return fail(400, "That part isn't in this sitting.");
    }

    const result = await applyFieldEdit({
      recordId: record.id,
      field,
      body: input.body,
      known: await knownEntities(record.id),
      // An edit made in a sitting goes in that sitting's transcript, so the
      // record says where the value came from.
      messageId: () =>
        appendSittingMessage(record.id, sitting.id, {
          role: "tool",
          content: `Edited: ${field.label}`,
          blocks: [],
        }),
    });
    if (!result.ok) return fail(400, result.message);
    return reply();
  } catch (err) {
    await logFailure({ context: "sitting:edit", error: err, recordId: record.id, userId: session.user.id });
    return fail(500, "Something went wrong saving that. Please try again.");
  }
}
