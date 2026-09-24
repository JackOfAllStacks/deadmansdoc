import { fieldsById } from "@/lib/content";
import {
  attributeKeysFor,
  defaultDisclosure,
  entityTypeFor,
  type saveAmountSchema,
  type saveEntitySchema,
  type saveFieldSchema,
} from "@/lib/sitting/schema";
import type { z } from "zod";

// Turning a tool call into something worth writing down. Pure, so every rule
// here is testable without a database. A string coming back is a message for
// the model, not an exception: a wrong shape is a thing to be told about and
// corrected, the same way the intake conversation already handles it.

export interface KnownEntity {
  id: string;
  entityType: string;
  label: string;
}

export interface FieldCapture {
  kind: "field";
  fieldId: string;
  value: unknown;
  disclosure: string;
  confidence: string;
  familyAction: string | null;
  /** Entities this answer points at, for a field of type `people`. */
  references: string[];
}

export interface EntityCapture {
  kind: "entity";
  fieldId: string;
  entityType: string;
  label: string;
  data: Record<string, string>;
  familyAction: string | null;
  confidence: string;
}

export interface AmountCapture {
  kind: "amount";
  fieldId: string;
  entityId: string;
  amount: string;
  confidence: string;
}

function listKnown(known: KnownEntity[], entityType: string): string {
  const labels = known.filter((k) => k.entityType === entityType).map((k) => k.label);
  return labels.length ? labels.join(", ") : "nothing yet";
}

export function validateSaveField(
  input: z.infer<typeof saveFieldSchema>,
  known: KnownEntity[],
): FieldCapture | string {
  const field = fieldsById.get(input.field_id);
  if (!field) return `There is no field called ${input.field_id}.`;

  const filled = [
    input.text !== null && input.text.trim() !== "" ? "text" : null,
    input.items !== null && input.items.length ? "items" : null,
    input.people !== null && input.people.length ? "people" : null,
  ].filter(Boolean);

  if (filled.length === 0) return `${field.id} needs a value. Nothing was sent.`;
  if (filled.length > 1) return `Send only one of text, items or people. This had ${filled.join(" and ")}.`;

  const base = {
    kind: "field" as const,
    fieldId: field.id,
    disclosure: input.disclosure ?? defaultDisclosure(field.id),
    confidence: input.confidence,
    familyAction: input.family_action,
  };

  if (field.type === "text") {
    if (filled[0] !== "text") return `${field.id} is written as prose. Use text, not ${filled[0]}.`;
    return { ...base, value: input.text!.trim(), references: [] };
  }

  if (field.type === "list" || field.type === "ordered") {
    if (filled[0] !== "items") {
      const shape = field.type === "ordered" ? "an ordered sequence" : "a list";
      return `${field.id} is ${shape}. Use items, not ${filled[0]}.`;
    }
    const items = input.items!.map((i) => i.trim()).filter(Boolean);
    if (!items.length) return `${field.id} needs at least one item.`;
    return { ...base, value: items, references: [] };
  }

  // type "people": names must already exist, so the key-people list stays the
  // spine of the document rather than filling up with half-known names.
  if (filled[0] !== "people") return `${field.id} points at people. Use people, not ${filled[0]}.`;
  const references: string[] = [];
  const names: string[] = [];
  for (const name of input.people!) {
    const match = known.find((k) => k.entityType === "person" && k.label.toLowerCase() === name.trim().toLowerCase());
    if (!match) {
      return `Nobody called "${name}" has been recorded yet. Record them with save_entity first. So far: ${listKnown(known, "person")}.`;
    }
    references.push(match.id);
    names.push(match.label);
  }
  if (!references.length) return `${field.id} needs at least one person.`;
  return { ...base, value: names, references };
}

export function validateSaveEntity(input: z.infer<typeof saveEntitySchema>): EntityCapture | string {
  const field = fieldsById.get(input.field_id);
  const entityType = entityTypeFor(input.field_id);
  if (!field || !entityType) return `There is no list called ${input.field_id}.`;

  const label = input.label.trim();
  if (!label) return "Every entry needs a name to be known by.";

  const allowed = attributeKeysFor(input.field_id);
  const data: Record<string, string> = {};
  for (const { key, value } of input.attributes) {
    if (!allowed.includes(key)) {
      return `"${key}" isn't something ${field.id} records. It takes: ${allowed.join(", ")}.`;
    }
    const trimmed = value.trim();
    if (trimmed) data[key] = trimmed;
  }

  return {
    kind: "entity",
    fieldId: field.id,
    entityType,
    label,
    data,
    familyAction: input.family_action,
    confidence: input.confidence,
  };
}

export function validateSaveAmount(
  input: z.infer<typeof saveAmountSchema>,
  known: KnownEntity[],
): AmountCapture | string {
  const field = fieldsById.get(input.field_id);
  const entityType = entityTypeFor(input.field_id);
  if (!field || !entityType) return `There is no field called ${input.field_id}.`;

  const match = known.find(
    (k) => k.entityType === entityType && k.label.toLowerCase() === input.entity_label.trim().toLowerCase(),
  );
  if (!match) {
    return `There's no ${entityType} called "${input.entity_label}" yet. Record it first. So far: ${listKnown(known, entityType)}.`;
  }

  const amount = input.amount.trim();
  if (!amount) return "The figure was empty.";

  return { kind: "amount", fieldId: field.id, entityId: match.id, amount, confidence: input.confidence };
}
