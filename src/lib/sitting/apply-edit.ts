import { fieldsById, type Field } from "@/lib/content";
import { parseBlock, type BlockShape } from "@/lib/sitting/block";
import { clearField, keepOnlyEntities, saveAmount, saveEntity, saveFieldValue } from "@/lib/sitting/capture";
import { attributeKeysFor } from "@/lib/sitting/schema";
import {
  validateSaveAmount,
  validateSaveEntity,
  validateSaveField,
  type KnownEntity,
} from "@/lib/sitting/validate";

/*
 * Writing a field from something a person typed.
 *
 * This was the body of /api/sitting/edit and belonged to the sitting it ran
 * in. It now sits on its own because there is a second place a person can
 * correct their own record -- the loose ends page, where no sitting is open --
 * and the whole value of the hand-edit path is that it goes through the same
 * schemas and validators a tool call goes through. Two copies of that would be
 * two sets of rules, and the point is that there is one.
 */

/** The message a refusal is written for is a person, not the model. */
export type EditResult = { ok: true } | { ok: false; message: string };

/**
 * validate.ts writes for the model: tool names and field ids are exactly right
 * there, and exactly wrong in front of someone correcting their own document.
 */
export function humanise(message: string): string {
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

export function blockShapeFor(field: Field): BlockShape {
  return {
    type: field.type,
    attributeKeys: attributeKeysFor(field.id),
    sealed: field.disclosure === "sealed",
  };
}

export interface FieldEdit {
  recordId: string;
  field: Field;
  /** The field's body, as the same text it was shown as. */
  body: string;
  known: KnownEntity[];
  /**
   * Resolved once, and only when something is actually being written. An edit
   * made during a sitting goes in the transcript so the record says where the
   * value came from; one made outside a sitting has no message behind it.
   */
  messageId: () => Promise<string | null>;
}

export async function applyFieldEdit({ recordId, field, body, known, messageId }: FieldEdit): Promise<EditResult> {
  const shape = blockShapeFor(field);
  const parsed = parseBlock(shape, body);

  if (parsed.kind === "clear") {
    if (field.type === "entities") await keepOnlyEntities(recordId, field.id, []);
    else await clearField(recordId, field.id);
    return { ok: true };
  }

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
      // A field that points at people takes names and nothing else, which the
      // heading above it doesn't always make obvious -- several of them read
      // like questions you'd answer in a sentence.
      if (field.type === "people") {
        const names = known.filter((k) => k.entityType === "person").map((k) => k.label);
        return {
          ok: false,
          message: names.length
            ? `This part lists people by name, separated by commas — and only people already in the document: ${names.join(", ")}.`
            : "This part lists people by name, but nobody has been recorded yet. Add them to the key people list first.",
        };
      }
      return { ok: false, message: humanise(capture) };
    }
    await saveFieldValue(recordId, capture, await messageId());
    return { ok: true };
  }

  // Entities: everything still listed is written, and anything no longer
  // listed stops belonging to this field.
  const id = await messageId();
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
      if (typeof capture === "string") return { ok: false, message: humanise(capture) };
      await saveAmount(recordId, capture, id);
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
    if (typeof capture === "string") return { ok: false, message: humanise(capture) };
    kept.push(await saveEntity(recordId, capture, id));
  }
  await keepOnlyEntities(recordId, field.id, kept);
  return { ok: true };
}
