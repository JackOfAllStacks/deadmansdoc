import { describe, expect, it } from "vitest";
import { hasSealedContent, renderEnvelope, renderGuide, type PrintMeta } from "@/lib/artifact/render";
import type { EntityRow, RecordData, ValueRow } from "@/lib/artifact/collect";

// The rules being checked here come from docs/Artifact Template.md, and the
// awkward ones matter most: a sealed item must leave a visible marker rather
// than a blank, and one sealed item is enough to print an envelope.

const meta: PrintMeta = { version: "1", preparedOn: "24 September 2026" };

const value = (over: Partial<ValueRow> & { field_id: string }): ValueRow => ({
  entity_instance_id: null,
  value: "something",
  status: "answered",
  disclosure: "open",
  confidence: "stated",
  family_action: null,
  who_would_know: null,
  gap_priority: null,
  ...over,
});

const data = (values: ValueRow[], entities: EntityRow[] = [], notes: RecordData["notes"] = []): RecordData => ({
  header: {
    id: "rec-1",
    subject_name: "John",
    subject_relationship: "parent",
    present: ["Jack", "John"],
    intake: null,
    intake_completed_at: null,
    created_at: "2026-09-01",
    owner_email: "jack@example.test",
  },
  values,
  entities,
  notes,
});

describe("the Guide", () => {
  it("prints a heading for every in-scope section, even an empty record", () => {
    const guide = renderGuide(data([]), meta);
    for (const n of [1, 2, 3, 5]) expect(guide).toContain(`## Section ${n} —`);
    expect(guide).toContain("Nothing recorded yet for this part.");
  });

  it("says plainly that it isn't a will", () => {
    expect(renderGuide(data([]), meta)).toContain("not a will");
  });

  it("numbers an ordered field and bullets a list", () => {
    const guide = renderGuide(
      data([
        value({ field_id: "s2.first_72h", value: ["Ring Jack", "Ring the funeral home"] }),
        value({ field_id: "s2.deadlines", value: ["Probate", "Insurance claim"] }),
      ]),
      meta,
    );
    expect(guide).toContain("1. Ring Jack");
    expect(guide).toContain("2. Ring the funeral home");
    expect(guide).toContain("- Probate");
    expect(guide).not.toContain("1. Probate");
  });

  it("carries what the family has to do, under the thing it applies to", () => {
    const guide = renderGuide(
      data([value({ field_id: "s5.bill_account", value: "NAB everyday", family_action: "Keep it open." })]),
      meta,
    );
    expect(guide).toContain("NAB everyday");
    expect(guide).toContain("_What to do: Keep it open._");
  });

  it("flags a value they weren't sure about", () => {
    const guide = renderGuide(
      data([value({ field_id: "s5.tax_outstanding", value: "Maybe a BAS due", confidence: "uncertain" })]),
      meta,
    );
    expect(guide).toContain("weren't certain");
  });

  it("prints a gap with whoever would know, rather than leaving it blank", () => {
    const guide = renderGuide(
      data([value({ field_id: "s5.tax_outstanding", status: "unknown", value: null, who_would_know: "Peter" })]),
      meta,
    );
    expect(guide).toContain("_Not yet known. — Peter may know._");
  });

  it("says so when nobody at all would know", () => {
    const guide = renderGuide(
      data([value({ field_id: "s5.tax_outstanding", status: "unknown", value: null })]),
      meta,
    );
    expect(guide).toContain("nobody has been identified who would know");
  });

  it("marks a sealed item rather than leaving a blank where it was", () => {
    const guide = renderGuide(
      data([
        value({ field_id: "s5.accounts", value: "NAB everyday" }),
        value({ field_id: "s5.cash", value: ["$2,000 in the safe"], disclosure: "sealed" }),
      ]),
      meta,
    );
    expect(guide).toContain("One item here is in the sealed envelope.");
    expect(guide).not.toContain("$2,000");
  });

  it("still prints a section whose every item is sealed", () => {
    const guide = renderGuide(data([value({ field_id: "s5.cash", value: ["hidden"], disclosure: "sealed" })]), meta);
    expect(guide).toContain("## Section 5 —");
    expect(guide).toContain("Everything recorded for this section is in the sealed envelope.");
    expect(guide).not.toContain("hidden");
  });

  it("tells the family an envelope exists, without saying what's in it", () => {
    const guide = renderGuide(data([value({ field_id: "s5.cash", value: ["x"], disclosure: "sealed" })]), meta);
    expect(guide).toContain("There is a sealed envelope");
  });

  it("says there is no envelope when nothing is sealed, so nobody hunts for one", () => {
    const guide = renderGuide(data([value({ field_id: "s5.bill_account", value: "NAB" })]), meta);
    expect(guide).toContain("There is no sealed envelope");
  });

  it("includes anything kept that no field covered", () => {
    const guide = renderGuide(
      data([], [], [{ label: "Shed key", value: "Under the third pot.", family_action: null, confidence: "stated" }]),
      meta,
    );
    expect(guide).toContain("**Shed key** — Under the third pot.");
  });

  it("prints an entity with its details", () => {
    const entities: EntityRow[] = [
      { id: "e1", entity_type: "person", label: "Robyn", data: { relationship: "sister", phone: "0412 555 010" } },
    ];
    const guide = renderGuide(
      data([value({ field_id: "s3.key_people", entity_instance_id: "e1", value: {} })], entities),
      meta,
    );
    expect(guide).toContain("**Robyn**");
    expect(guide).toContain("relationship: sister");
    expect(guide).toContain("phone: 0412 555 010");
  });
});

describe("the Sealed Envelope", () => {
  it("doesn't print at all when nothing is sealed", () => {
    expect(renderEnvelope(data([value({ field_id: "s5.bill_account", value: "NAB" })]), meta)).toBeNull();
    expect(hasSealedContent(data([value({ field_id: "s5.bill_account", value: "NAB" })]))).toBe(false);
  });

  it("prints for a single sealed item — there is no minimum", () => {
    const envelope = renderEnvelope(
      data([value({ field_id: "s5.cash", value: ["$2,000 in the safe"], disclosure: "sealed" })]),
      meta,
    );
    expect(envelope).toContain("$2,000 in the safe");
  });

  it("stands on its own, for someone opening it months later", () => {
    const envelope = renderEnvelope(data([value({ field_id: "s5.cash", value: ["x"], disclosure: "sealed" })]), meta)!;
    expect(envelope).toContain("John");
    expect(envelope).toContain("24 September 2026");
    expect(envelope).toContain("Version:");
    expect(envelope).toContain("opened only after they have died");
  });

  it("holds nothing that was open", () => {
    const envelope = renderEnvelope(
      data([
        value({ field_id: "s5.bill_account", value: "NAB everyday" }),
        value({ field_id: "s5.cash", value: ["$2,000"], disclosure: "sealed" }),
      ]),
      meta,
    )!;
    expect(envelope).toContain("$2,000");
    expect(envelope).not.toContain("NAB everyday");
  });

  it("keeps a sealed amount with the thing it belongs to", () => {
    const entities: EntityRow[] = [
      { id: "a1", entity_type: "account", label: "NAB everyday", data: { institution: "NAB" } },
    ];
    const envelope = renderEnvelope(
      data(
        [value({ field_id: "s5.balances", entity_instance_id: "a1", value: { amount: "$4,000" }, disclosure: "sealed" })],
        entities,
      ),
      meta,
    )!;
    expect(envelope).toContain("**NAB everyday**");
    expect(envelope).toContain("amount: $4,000");
  });

  it("leaves out a section with nothing sealed in it", () => {
    const envelope = renderEnvelope(
      data([value({ field_id: "s5.cash", value: ["x"], disclosure: "sealed" })]),
      meta,
    )!;
    expect(envelope).toContain("## Section 5 —");
    expect(envelope).not.toContain("## Section 3 —");
  });
});
