import { z } from "zod";
import { artifact, fieldsById, sectionFields, type Disclosure, type Field } from "@/lib/content";
import { toToolSchema } from "@/lib/intake/signals";

// The tools a sitting uses, derived from data/artifact-fields.yaml rather than
// written out by hand. Adding a field or an entity shape to that file changes
// what the model can record, with no code change here.

export const CONFIDENCE = ["stated", "uncertain", "inferred"] as const;
export const PRIORITIES = ["high", "medium", "low"] as const;
export const DISCLOSURES = ["open", "sealed", "pointer"] as const;

const allFields = artifact.sections.flatMap(sectionFields);

export const ENTITY_FIELDS = allFields.filter((f) => f.type === "entities");
// An entity-typed field that is sealed holds a figure against something already
// recorded -- balances against accounts, expected amounts against income. They
// are filled by save_amount, never by save_entity, so a sealed number can never
// be written into the open list it belongs to.
export const AMOUNT_FIELDS = ENTITY_FIELDS.filter((f) => f.disclosure === "sealed");
export const ENTITY_LIST_FIELDS = ENTITY_FIELDS.filter((f) => f.disclosure !== "sealed");
export const PLAIN_FIELDS = allFields.filter((f) => f.type !== "entities");

const ids = (fields: Field[]) => fields.map((f) => f.id);

// zod needs a non-empty tuple for an enum; every list below is non-empty for
// the real content file, and contentProblems() would have failed the build
// first if a section were empty.
function enumOf(values: string[]) {
  return z.enum(values as [string, ...string[]]);
}

export function entityTypeFor(fieldId: string): string | undefined {
  return fieldsById.get(fieldId)?.entity;
}

export function attributeKeysFor(fieldId: string): string[] {
  const type = entityTypeFor(fieldId);
  return type ? (artifact.entities[type] ?? []) : [];
}

const ALL_ATTRIBUTE_KEYS = [...new Set(Object.values(artifact.entities).flat())].sort();

export const saveFieldSchema = z
  .object({
    field_id: enumOf(ids(PLAIN_FIELDS)).describe("Which field this answer fills."),
    text: z.string().nullable().describe("For a prose field. Null otherwise."),
    items: z
      .array(z.string())
      .nullable()
      .describe("For a list or an ordered sequence. In order where the order matters. Null otherwise."),
    people: z
      .array(z.string())
      .nullable()
      .describe("For a field that points at people: their names exactly as already recorded. Null otherwise."),
    family_action: z
      .string()
      .nullable()
      .describe(
        "What the family will have to DO about this, in plain terms someone who has never touched it could follow. " +
          "Write 'Nothing -- it runs on its own' when there is genuinely nothing to do; that is a useful answer, not a blank.",
      ),
    confidence: enumOf([...CONFIDENCE]).describe(
      "'stated' if they said it plainly, 'uncertain' if they hedged, 'inferred' if you worked it out.",
    ),
    disclosure: enumOf([...DISCLOSURES])
      .nullable()
      .describe("Only when they ask for something to be treated differently from the default. Null otherwise."),
  })
  .strict();

export const saveEntitySchema = z
  .object({
    field_id: enumOf(ids(ENTITY_LIST_FIELDS)).describe("Which list this belongs to."),
    label: z
      .string()
      .describe(
        "A short, stable name: a person's name, or what the thing is called. Use the same wording every time so the " +
          "same entry is updated rather than recorded twice.",
      ),
    attributes: z
      .array(
        z
          .object({
            key: enumOf(ALL_ATTRIBUTE_KEYS).describe("Which detail this is. Only keys valid for this list are accepted."),
            value: z.string(),
          })
          .strict(),
      )
      .describe("The details known so far. Leave out anything not yet known rather than guessing."),
    family_action: z.string().nullable(),
    confidence: enumOf([...CONFIDENCE]),
  })
  .strict();

export const saveAmountSchema = z
  .object({
    field_id: enumOf(ids(AMOUNT_FIELDS)).describe("Which kind of figure this is."),
    entity_label: z.string().describe("The entry this figure belongs to, exactly as already recorded."),
    amount: z.string().describe("As they said it. Don't convert, round or interpret."),
    confidence: enumOf([...CONFIDENCE]),
  })
  .strict();

export const flagGapSchema = z
  .object({
    field_id: enumOf(ids(allFields)).describe("What they don't know."),
    who_would_know: z
      .string()
      .nullable()
      .describe("Who might know instead -- a person, an institution, or 'nobody'. Null if they have no idea."),
    priority: enumOf([...PRIORITIES]).describe("How much worse this gets if nobody closes it before they die."),
    note: z.string().nullable().describe("Anything worth keeping about why it's unknown."),
  })
  .strict();

export const saveNoteSchema = z
  .object({
    label: z.string().describe("A short, stable name for this, so it updates rather than duplicating."),
    value: z.string(),
    family_action: z.string().nullable(),
    confidence: enumOf([...CONFIDENCE]),
  })
  .strict();

export const finishSittingSchema = z
  .object({
    summary: z
      .string()
      .describe("Two or three plain sentences on how it went and what's worth picking up next time."),
  })
  .strict();

export const TOOL_SCHEMAS = {
  save_field: saveFieldSchema,
  save_entity: saveEntitySchema,
  save_amount: saveAmountSchema,
  flag_gap: flagGapSchema,
  save_note: saveNoteSchema,
  finish_sitting: finishSittingSchema,
} as const;

export type ToolName = keyof typeof TOOL_SCHEMAS;

const DESCRIPTIONS: Record<ToolName, string> = {
  save_field:
    "Record one answer against one field. Call it as soon as you have something worth keeping, in the same turn you " +
    "learn it -- never batched up at the end. Calling it again for the same field replaces what's there, so only do " +
    "that when you have something better.",
  save_entity:
    "Record one person, account, bill, debt, income stream or routing rule, or add newly learned details to one " +
    "already recorded. One call per entry.",
  save_amount:
    "Record a figure against something already recorded. Figures are sealed: they print in the Sealed Envelope, " +
    "never in the Guide the family reads.",
  flag_gap:
    "Record something they don't know. Use this for every 'I'm not sure' rather than letting it go -- a gap with " +
    "someone attached to it is useful output on its own. Don't press further once it's recorded.",
  save_note:
    "Record something worth keeping that none of the fields covers. Use it sparingly; prefer a field when one fits.",
  finish_sitting: "End the sitting, when the ground is covered or they want to stop.",
};

export function toolsFor(): { name: string; description: string; input_schema: object; strict: true }[] {
  return (Object.keys(TOOL_SCHEMAS) as ToolName[]).map((name) => ({
    name,
    description: DESCRIPTIONS[name],
    input_schema: toToolSchema(TOOL_SCHEMAS[name]),
    strict: true,
  }));
}

export function defaultDisclosure(fieldId: string): Disclosure {
  return fieldsById.get(fieldId)?.disclosure ?? "open";
}
