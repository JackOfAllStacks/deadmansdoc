import { z } from "zod";
import { fieldsById } from "@/lib/content";
import { logFailure } from "@/lib/errors";
import { getRecordForUser } from "@/lib/records";
import { getSession } from "@/lib/session";
import {
  entityData,
  filledFields,
  knownEntities,
  saveAmount,
  saveEntity,
  saveFieldValue,
  saveNote,
  updateEntity,
} from "@/lib/sitting/capture";
import { coverageOf, sittingFields } from "@/lib/sitting/coverage";
import { formatEntityText, formatFieldText } from "@/lib/sitting/format";
import { saveAmountSchema, saveEntitySchema, saveFieldSchema, saveNoteSchema } from "@/lib/sitting/schema";
import { appendSittingMessage, openSitting } from "@/lib/sitting/store";
import { validateSaveAmount, validateSaveEntity, validateSaveField } from "@/lib/sitting/validate";

// A direct correction from the document panel: the same shapes and rules a
// tool call would go through (schema.ts, validate.ts), just triggered by
// someone editing rather than the model calling a tool. Everything still
// goes through a real turn's worth of bookkeeping -- a message row to trace
// it back to, the coverage recount -- so a hand-edited value is no different
// from a spoken one once it's saved.

const bodySchema = z.discriminatedUnion("kind", [
  saveFieldSchema.extend({ kind: z.literal("field") }).strict(),
  saveEntitySchema.extend({ kind: z.literal("entity"), entity_id: z.string().nullable() }).strict(),
  saveAmountSchema.extend({ kind: z.literal("amount") }).strict(),
  saveNoteSchema.extend({ kind: z.literal("note") }).strict(),
]);

const fail = (status: number, message: string) => Response.json({ error: message }, { status });
const labelOf = (fieldId: string) => fieldsById.get(fieldId)?.label ?? fieldId;

// validate.ts writes for the model: tool names and field ids are exactly
// right there, and exactly wrong in front of a person correcting their own
// document. Same rules, same refusals, said the way the panel needs them.
function humanise(message: string): string {
  let out = message
    .replace(/Record them with save_entity first\./g, "Add them to the key people list first.")
    .replace(/\bsave_entity\b/g, "the list above")
    .replace(/\bsave_field\b/g, "this field")
    .replace(/\bsave_amount\b/g, "the figure beside it");
  for (const [id, field] of fieldsById) {
    if (out.includes(id)) out = out.replaceAll(id, `"${field.label}"`);
  }
  return out;
}

const reject = (message: string) => fail(400, humanise(message));

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail(401, "Please sign in again.");

  const record = await getRecordForUser(session.user.id);
  if (!record) return fail(404, "Start a record first.");

  const sitting = await openSitting(record.id);
  if (!sitting) return fail(409, "No sitting is open. Start one from your plan.");

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail(400, "That edit didn't match what was expected.");
  const data = body.data;

  // Only fields this sitting's document panel actually shows can be edited
  // through it -- the same boundary the panel itself is built from. A note
  // isn't tied to a field, so there's nothing to check.
  if (data.kind !== "note" && !sittingFields(sitting.covers).some((f) => f.id === data.field_id)) {
    return fail(400, "That field isn't part of this sitting.");
  }

  const known = await knownEntities(record.id);
  const editMessage = (label: string) =>
    appendSittingMessage(record.id, sitting.id, { role: "tool", content: `Edited: ${label}`, blocks: [] });

  try {
    if (data.kind === "field") {
      const capture = validateSaveField(data, known);
      if (typeof capture === "string") return reject(capture);

      const messageId = await editMessage(labelOf(capture.fieldId));
      await saveFieldValue(record.id, capture, messageId);
      return Response.json({
        kind: "field",
        fieldId: capture.fieldId,
        entityId: null,
        label: "",
        text: formatFieldText(capture.value),
        detail: capture.familyAction,
        attributes: null,
        progress: coverageOf(sitting.covers, await filledFields(record.id)),
      });
    }

    if (data.kind === "entity") {
      const capture = validateSaveEntity(data);
      if (typeof capture === "string") return reject(capture);

      const messageId = await editMessage(capture.label);

      let entityId = data.entity_id;
      if (entityId) {
        if (!known.some((k) => k.id === entityId)) return fail(404, "That entry doesn't exist any more.");
        await updateEntity(record.id, entityId, capture, messageId);
      } else {
        entityId = await saveEntity(record.id, capture, messageId);
      }
      const merged = await entityData(record.id, entityId);
      return Response.json({
        kind: "entity",
        fieldId: capture.fieldId,
        entityId,
        label: capture.label,
        text: formatEntityText(merged),
        detail: labelOf(capture.fieldId),
        attributes: merged,
        progress: coverageOf(sitting.covers, await filledFields(record.id)),
      });
    }

    if (data.kind === "amount") {
      const capture = validateSaveAmount(data, known);
      if (typeof capture === "string") return reject(capture);

      const messageId = await editMessage(data.entity_label);
      await saveAmount(record.id, capture, messageId);
      return Response.json({
        kind: "amount",
        fieldId: capture.fieldId,
        entityId: capture.entityId,
        label: "",
        text: null,
        detail: "sealed",
        attributes: null,
        progress: coverageOf(sitting.covers, await filledFields(record.id)),
      });
    }

    // kind === "note"
    if (!data.value.trim()) return fail(400, "A note needs some text.");
    const messageId = await editMessage(data.label);
    await saveNote(
      record.id,
      sitting.id,
      { label: data.label, value: data.value, familyAction: data.family_action, confidence: data.confidence },
      messageId,
    );
    return Response.json({
      kind: "note",
      fieldId: null,
      entityId: null,
      label: data.label,
      text: data.value,
      detail: data.family_action,
      attributes: null,
      progress: coverageOf(sitting.covers, await filledFields(record.id)),
    });
  } catch (err) {
    await logFailure({ context: "sitting:edit", error: err, recordId: record.id, userId: session.user.id });
    return fail(500, "Something went wrong saving that. Please try again.");
  }
}
