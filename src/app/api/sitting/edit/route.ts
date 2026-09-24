import { z } from "zod";
import { fieldsById } from "@/lib/content";
import { logFailure } from "@/lib/errors";
import { getRecordForUser } from "@/lib/records";
import { getSession } from "@/lib/session";
import { parseBlock, type BlockShape } from "@/lib/sitting/block";
import {
  capturedIn,
  clearField,
  deleteNote,
  filledFields,
  keepOnlyEntities,
  knownEntities,
  saveAmount,
  saveEntity,
  saveFieldValue,
  saveNote,
} from "@/lib/sitting/capture";
import { coverageOf, sittingFields } from "@/lib/sitting/coverage";
import { documentOutline, looseNotes } from "@/lib/sitting/document";
import { attributeKeysFor } from "@/lib/sitting/schema";
import { appendSittingMessage, openSitting } from "@/lib/sitting/store";
import { validateSaveAmount, validateSaveEntity, validateSaveField } from "@/lib/sitting/validate";

// Editing the document directly. One field's body arrives as the same text it
// was shown as, and is parsed back through the schemas and validators a tool
// call goes through -- so nothing can be typed in that the model couldn't have
// recorded, and a line someone deleted actually goes.
//
// The response is read back out of the database rather than assembled from
// what was just sent, so what lands on screen is what was really stored.

const bodySchema = z.union([
  z.object({ field_id: z.string(), body: z.string().max(10_000) }).strict(),
  z.object({ note_label: z.string(), body: z.string().max(10_000) }).strict(),
]);

const fail = (status: number, message: string) => Response.json({ error: message }, { status });

// validate.ts writes for the model: tool names and field ids are exactly right
// there, and exactly wrong in front of someone correcting their own document.
function humanise(message: string): string {
  let out = message
    .replace(/Record them with save_entity first\./g, "Add them to the key people list first.")
    .replace(/\bsave_entity\b/g, "that list")
    .replace(/\bsave_field\b/g, "this part")
    .replace(/\bsave_amount\b/g, "the figure beside it");
  for (const [id, field] of fieldsById) {
    if (out.includes(id)) out = out.replaceAll(id, `"${field.label}"`);
  }
  return out;
}

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

    const shape: BlockShape = {
      type: field.type,
      attributeKeys: attributeKeysFor(field.id),
      sealed: field.disclosure === "sealed",
    };
    const parsed = parseBlock(shape, input.body);
    const known = await knownEntities(record.id);

    if (parsed.kind === "clear") {
      if (field.type === "entities") await keepOnlyEntities(record.id, field.id, []);
      else await clearField(record.id, field.id);
      return reply();
    }

    const messageId = await appendSittingMessage(record.id, sitting.id, {
      role: "tool",
      content: `Edited: ${field.label}`,
      blocks: [],
    });

    if (parsed.kind === "value") {
      const capture = validateSaveField(
        {
          field_id: field.id,
          text: parsed.text,
          items: parsed.items,
          people: parsed.people,
          family_action: parsed.familyAction,
          confidence: "stated",
          disclosure: null,
        },
        known,
      );
      if (typeof capture === "string") {
        // A field that points at people takes names and nothing else, which
        // the heading above it doesn't always make obvious -- several of them
        // read like questions you'd answer in a sentence.
        if (field.type === "people") {
          const names = known.filter((k) => k.entityType === "person").map((k) => k.label);
          return fail(
            400,
            names.length
              ? `This part lists people by name, separated by commas — and only people already in the document: ${names.join(", ")}.`
              : "This part lists people by name, but nobody has been recorded yet. Add them to the key people list first.",
          );
        }
        return fail(400, humanise(capture));
      }
      await saveFieldValue(record.id, capture, messageId);
      return reply();
    }

    // Entities: everything still listed is written, and anything no longer
    // listed stops belonging to this field.
    const kept: string[] = [];
    for (const entry of parsed.entries) {
      if (shape.sealed) {
        if (!entry.amount) {
          const existing = known.find((k) => k.label.toLowerCase() === entry.label.toLowerCase());
          if (existing) kept.push(existing.id);
          continue;
        }
        const capture = validateSaveAmount(
          { field_id: field.id, entity_label: entry.label, amount: entry.amount, confidence: "stated" },
          known,
        );
        if (typeof capture === "string") return fail(400, humanise(capture));
        await saveAmount(record.id, capture, messageId);
        kept.push(capture.entityId);
        continue;
      }

      const capture = validateSaveEntity({
        field_id: field.id,
        label: entry.label,
        attributes: entry.attributes,
        family_action: entry.familyAction,
        confidence: "stated",
      });
      if (typeof capture === "string") return fail(400, humanise(capture));
      kept.push(await saveEntity(record.id, capture, messageId));
    }
    await keepOnlyEntities(record.id, field.id, kept);
    return reply();
  } catch (err) {
    await logFailure({ context: "sitting:edit", error: err, recordId: record.id, userId: session.user.id });
    return fail(500, "Something went wrong saving that. Please try again.");
  }
}
