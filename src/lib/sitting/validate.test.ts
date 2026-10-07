import { describe, expect, it } from "vitest";
import { fieldsById } from "@/lib/content";
import { AMOUNT_FIELDS, ENTITY_LIST_FIELDS, PLAIN_FIELDS, toolsFor } from "@/lib/sitting/schema";
import { validateSaveAmount, validateSaveEntity, validateSaveField, type KnownEntity } from "@/lib/sitting/validate";

const known: KnownEntity[] = [
  { id: "p1", entityType: "person", label: "Priya" },
  { id: "p2", entityType: "person", label: "Michael" },
  { id: "a1", entityType: "account", label: "NAB everyday" },
];

const field = (over: Partial<Parameters<typeof validateSaveField>[0]> = {}) => ({
  field_id: "s3.interrelationships",
  value: [] as string[],
  family_action: null,
  confidence: "stated" as const,
  disclosure: null,
  ...over,
});

describe("the tools built from the content files", () => {
  it("covers every field exactly once, between the plain, list and amount tools", () => {
    const all = [...PLAIN_FIELDS, ...ENTITY_LIST_FIELDS, ...AMOUNT_FIELDS].map((f) => f.id);
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(all)).toEqual(new Set([...fieldsById.keys()]));
  });

  it("treats a sealed list field as a figure, not a list", () => {
    // Balances and expected amounts hang off an entry that already exists, so
    // a sealed number can never be written into the open list beside it.
    expect(AMOUNT_FIELDS.map((f) => f.id)).toEqual(["s5.balances", "s5.expected_amounts"]);
    for (const f of ENTITY_LIST_FIELDS) expect(f.disclosure).not.toBe("sealed");
  });

  it("produces strict schemas the API will accept", () => {
    for (const tool of toolsFor()) {
      expect(tool.strict).toBe(true);
      expect(JSON.stringify(tool.input_schema)).not.toContain("$schema");
      expect(JSON.stringify(tool.input_schema)).not.toContain("minimum");
    }
  });
});

describe("validateSaveField", () => {
  // There is one argument now, whatever the field holds, and the field's own
  // declared type decides what happens to it. The two things this used to
  // reject -- the wrong slot, and two slots at once -- can no longer be said.
  it("takes prose for a text field", () => {
    const out = validateSaveField(field({ value: ["  They have never met.  "] }), known);
    expect(out).toMatchObject({ fieldId: "s3.interrelationships", value: "They have never met." });
  });

  it("reads more than one entry on a prose field as paragraphs, not as a mistake", () => {
    const out = validateSaveField(field({ value: ["They have never met.", "Priya would know why."] }), known);
    expect(out).toMatchObject({ value: "They have never met.\nPriya would know why." });
  });

  it("keeps the order of an ordered field", () => {
    const out = validateSaveField(
      field({ field_id: "s2.first_72h", value: ["Call Priya", "Ring the funeral home", "Find the will"] }),
      known,
    );
    expect(out).toMatchObject({ value: ["Call Priya", "Ring the funeral home", "Find the will"] });
  });

  it("drops blank entries but keeps the rest", () => {
    const out = validateSaveField(field({ field_id: "s2.deadlines", value: ["Probate", "  ", ""] }), known);
    expect(out).toMatchObject({ value: ["Probate"] });
  });

  it("refuses a value that is only blanks", () => {
    expect(validateSaveField(field({ field_id: "s2.deadlines", value: ["  "] }), known)).toBe(
      "s2.deadlines needs a value. Nothing was sent.",
    );
  });

  it("refuses an empty call", () => {
    expect(validateSaveField(field(), known)).toBe("s3.interrelationships needs a value. Nothing was sent.");
  });

  it("takes a single entry for a list, which is the common case", () => {
    expect(validateSaveField(field({ field_id: "s2.deadlines", value: ["Probate"] }), known)).toMatchObject({
      value: ["Probate"],
    });
  });

  it("resolves people by name, whatever the casing", () => {
    const out = validateSaveField(field({ field_id: "s3.financial_knower", value: ["priya"] }), known);
    expect(out).toMatchObject({ references: ["p1"], value: ["Priya"] });
  });

  it("refuses a person who hasn't been recorded, and lists who has", () => {
    const out = validateSaveField(field({ field_id: "s3.financial_knower", value: ["Dev"] }), known);
    expect(out).toContain('Nobody called "Dev" has been recorded yet');
    expect(out).toContain("Priya, Michael");
  });

  it("takes the field's own disclosure unless told otherwise", () => {
    expect(validateSaveField(field({ value: ["x"] }), known)).toMatchObject({ disclosure: "open" });
    expect(
      validateSaveField(field({ field_id: "s3.anticipated_disagreement", value: ["x"] }), known),
    ).toMatchObject({ disclosure: "sealed" });
    expect(validateSaveField(field({ value: ["x"], disclosure: "sealed" }), known)).toMatchObject({
      disclosure: "sealed",
    });
  });
});

describe("the save_field schema itself", () => {
  it("offers one way to send a value, so there is no wrong one to pick", () => {
    const tool = toolsFor().find((t) => t.name === "save_field")!;
    const props = (tool.input_schema as { properties: Record<string, unknown> }).properties;
    expect(Object.keys(props)).toContain("value");
    // The three it replaced. Each was a way to be wrong that cost a whole
    // extra model call, and neither can be sent now.
    expect(Object.keys(props)).not.toContain("text");
    expect(Object.keys(props)).not.toContain("items");
    expect(Object.keys(props)).not.toContain("people");
  });

  it("does not make the model choose between a string and a list either", () => {
    const tool = toolsFor().find((t) => t.name === "save_field")!;
    const value = (tool.input_schema as { properties: { value: object } }).properties.value;
    expect(JSON.stringify(value)).not.toContain("anyOf");
    expect(JSON.stringify(value)).not.toContain("oneOf");
  });
});

describe("validateSaveEntity", () => {
  const entity = (over = {}) => ({
    field_id: "s3.key_people",
    label: "Priya",
    attributes: [{ key: "relationship", value: "daughter" }],
    family_action: null,
    confidence: "stated" as const,
    ...over,
  });

  it("keeps the attributes the entity shape allows", () => {
    const out = validateSaveEntity(
      entity({
        attributes: [
          { key: "relationship", value: "daughter" },
          { key: "phone", value: "0400 000 000" },
        ],
      }),
    );
    expect(out).toMatchObject({
      entityType: "person",
      label: "Priya",
      data: { relationship: "daughter", phone: "0400 000 000" },
    });
  });

  it("refuses a key that belongs to a different shape, and names the right ones", () => {
    const out = validateSaveEntity(entity({ attributes: [{ key: "institution", value: "NAB" }] }));
    expect(out).toContain("isn't something s3.key_people records");
    expect(out).toContain("name, relationship, role, phone, email, notes");
  });

  it("refuses an entry with no name", () => {
    expect(validateSaveEntity(entity({ label: "   " }))).toBe("Every entry needs a name to be known by.");
  });

  it("allows an entry with nothing known about it yet", () => {
    expect(validateSaveEntity(entity({ attributes: [] }))).toMatchObject({ label: "Priya", data: {} });
  });
});

describe("validateSaveAmount", () => {
  const amount = (over = {}) => ({
    field_id: "s5.balances",
    entity_label: "NAB everyday",
    amount: "about $4,000",
    confidence: "uncertain" as const,
    ...over,
  });

  it("attaches a figure to something already recorded", () => {
    expect(validateSaveAmount(amount(), known)).toMatchObject({ entityId: "a1", amount: "about $4,000" });
  });

  it("keeps the figure exactly as it was said", () => {
    const out = validateSaveAmount(amount({ amount: " a bit over 4 grand " }), known);
    expect(out).toMatchObject({ amount: "a bit over 4 grand" });
  });

  it("refuses a figure against something that doesn't exist", () => {
    const out = validateSaveAmount(amount({ entity_label: "CommBank saver" }), known);
    expect(out).toContain('no account called "CommBank saver"');
  });

  it("won't attach a balance to a person", () => {
    const out = validateSaveAmount(amount({ entity_label: "Priya" }), known);
    expect(out).toContain('no account called "Priya"');
  });
});
