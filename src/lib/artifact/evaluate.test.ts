import { describe, expect, it } from "vitest";
import { standingsFromData } from "@/lib/artifact/evaluate";
import type { RecordData, ValueRow } from "@/lib/artifact/collect";

const value = (over: Partial<ValueRow> & { field_id: string }): ValueRow => ({
  entity_instance_id: null,
  value: "x",
  status: "answered",
  disclosure: "open",
  confidence: "stated",
  family_action: null,
  who_would_know: null,
  gap_priority: null,
  ...over,
});

const data = (values: ValueRow[]): RecordData => ({
  header: {
    id: "rec-1",
    subject_name: "John",
    subject_relationship: "parent",
    present: [],
    intake: null,
    intake_completed_at: null,
    created_at: "2026-09-01",
    owner_email: "jack@example.test",
  },
  values,
  entities: [],
  notes: [],
});

const standingOf = (values: ValueRow[], fieldId: string) =>
  standingsFromData(data(values)).find((s) => s.field.id === fieldId)!;

describe("standingsFromData", () => {
  it("counts a field with a value as recorded", () => {
    expect(standingOf([value({ field_id: "s5.bill_account" })], "s5.bill_account").standing).toBe("recorded");
  });

  it("keeps a recorded gap apart from something never raised", () => {
    const gap = standingOf(
      [value({ field_id: "s5.tax_outstanding", status: "unknown", who_would_know: "Peter" })],
      "s5.tax_outstanding",
    );
    expect(gap.standing).toBe("not-known");
    expect(gap.reason).toBe("Peter may know.");
    expect(standingOf([], "s5.tax_outstanding").standing).toBe("not-covered");
  });

  it("says when nobody was identified for a gap", () => {
    const gap = standingOf([value({ field_id: "s5.cash", status: "unknown" })], "s5.cash");
    expect(gap.reason).toBe("Nobody identified who would know.");
  });

  it("prefers an answer over a gap on the same field", () => {
    const rows = [
      value({ field_id: "s5.cash", status: "unknown" }),
      value({ field_id: "s5.cash", status: "answered" }),
    ];
    expect(standingOf(rows, "s5.cash").standing).toBe("recorded");
  });

  it("covers every v1 field and nothing outside scope", () => {
    const all = standingsFromData(data([]));
    expect(all).toHaveLength(54);
    expect(all.every((s) => /^s[1235]\./.test(s.field.id))).toBe(true);
  });

  it("starts an empty record as entirely not covered", () => {
    expect(standingsFromData(data([])).every((s) => s.standing === "not-covered")).toBe(true);
  });
});
