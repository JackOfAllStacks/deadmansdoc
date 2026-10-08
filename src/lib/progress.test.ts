import { describe, expect, it } from "vitest";
import { artifact, milestoneSet, sectionFields } from "@/lib/content";
import { harvestOf, progressFor } from "@/lib/progress";
import type { CapturedItem, FilledField } from "@/lib/sitting/capture";

const fieldsOf = (sectionId: string) =>
  sectionFields(artifact.sections.find((s) => s.id === sectionId)!).map((f) => f.id);

const answered = (ids: string[]): FilledField[] => ids.map((field_id) => ({ field_id, status: "answered" }));
const unknown = (ids: string[]): FilledField[] => ids.map((field_id) => ({ field_id, status: "unknown" }));

const sectionIn = (filled: FilledField[], id: string) =>
  progressFor(filled, "Your").sections.find((s) => s.id === id)!;

describe("progressFor — settled is not complete", () => {
  it("counts a section with every field answered as both", () => {
    const s = sectionIn(answered(fieldsOf("s1")), "s1");
    expect(s.settled).toBe(true);
    expect(s.complete).toBe(true);
  });

  it("counts a section that is all recorded gaps as settled but not complete", () => {
    // This is the case the whole distinction exists for: there is nothing left
    // to ask, and the family would know nothing.
    const s = sectionIn(unknown(fieldsOf("s1")), "s1");
    expect(s.settled).toBe(true);
    expect(s.complete).toBe(false);
    expect(s.gaps).toBe(s.total);
    expect(s.answered).toBe(0);
  });

  it("counts a section with one field left as neither", () => {
    const ids = fieldsOf("s1");
    const s = sectionIn(answered(ids.slice(0, -1)), "s1");
    expect(s.settled).toBe(false);
    expect(s.complete).toBe(false);
    expect(s.answered).toBe(ids.length - 1);
  });

  it("counts an empty record as neither, rather than as finished", () => {
    for (const s of progressFor([], "Your").sections) {
      expect(s.settled).toBe(false);
      expect(s.complete).toBe(false);
    }
  });

  it("ignores a skipped field, which is neither an answer nor a gap", () => {
    const ids = fieldsOf("s1");
    const filled: FilledField[] = [
      ...answered(ids.slice(1)),
      { field_id: ids[0], status: "skipped" },
    ];
    const s = sectionIn(filled, "s1");
    expect(s.settled).toBe(false);
    expect(s.answered).toBe(ids.length - 1);
  });
});

describe("progressFor — the totals", () => {
  it("adds up to every field in scope", () => {
    const all = artifact.sections.flatMap(sectionFields).map((f) => f.id);
    const p = progressFor(answered(all), "Your");
    expect(p.total).toBe(all.length);
    expect(p.answered).toBe(all.length);
    expect(p.outstanding).toBe(0);
  });

  it("keeps gaps and answers apart, and counts the rest as still to come", () => {
    const all = artifact.sections.flatMap(sectionFields).map((f) => f.id);
    const p = progressFor([...answered(all.slice(0, 5)), ...unknown(all.slice(5, 8))], "Your");
    expect(p.answered).toBe(5);
    expect(p.gaps).toBe(3);
    expect(p.outstanding).toBe(all.length - 8);
  });

  it("never reports a negative number of things still to come", () => {
    const all = artifact.sections.flatMap(sectionFields).map((f) => f.id);
    // Duplicate rows can't happen through the Map, but the arithmetic should
    // not be the thing that depends on that.
    const p = progressFor([...answered(all), ...answered(all)], "Your");
    expect(p.outstanding).toBe(0);
  });
});

describe("progressFor — the claims", () => {
  const needs = (id: string) => milestoneSet.milestones.find((m) => m.id === id)!.needs;

  it("says nothing is true about an empty record", () => {
    const p = progressFor([], "Your");
    expect(p.met).toEqual([]);
    expect(p.milestones.every((m) => !m.met)).toBe(true);
  });

  it("will not call a claim true off a recorded gap", () => {
    // The one mistake that would matter: telling someone their family would
    // know who to ring, when what is written down is that nobody knows.
    const p = progressFor(unknown(needs("who-to-ring")), "Your");
    expect(p.milestones.find((m) => m.id === "who-to-ring")!.met).toBe(false);
  });

  it("says which missing fields were asked about and recorded as unknown", () => {
    const ids = needs("who-to-ring");
    const claim = progressFor(unknown(ids), "Your").milestones.find((m) => m.id === "who-to-ring")!;
    expect(claim.missing.every((f) => f.gap)).toBe(true);
    const empty = progressFor([], "Your").milestones.find((m) => m.id === "who-to-ring")!;
    expect(empty.missing.some((f) => f.gap)).toBe(false);
  });

  it("calls it true once every field it names holds an answer", () => {
    const p = progressFor(answered(needs("who-to-ring")), "Your");
    const claim = p.milestones.find((m) => m.id === "who-to-ring")!;
    expect(claim.met).toBe(true);
    expect(claim.missing).toEqual([]);
    expect(p.met.map((m) => m.id)).toContain("who-to-ring");
  });

  it("will not call it true off part of what it names", () => {
    const ids = needs("the-money-keeps-running");
    expect(ids.length).toBeGreaterThan(1);
    const claim = progressFor(answered(ids.slice(1)), "Your").milestones.find(
      (m) => m.id === "the-money-keeps-running",
    )!;
    expect(claim.met).toBe(false);
    expect(claim.missing.map((f) => f.id)).toEqual([ids[0]]);
  });

  it("names what is missing in words, not field ids", () => {
    const claim = progressFor([], "Your").milestones.find((m) => m.id === "what-not-to-touch")!;
    expect(claim.missing).toHaveLength(1);
    expect(claim.missing[0].label).not.toMatch(/^s\d/);
    expect(claim.missing[0].label.length).toBeGreaterThan(10);
  });

  it("offers the nearest claim rather than the first one", () => {
    // One field away from what-not-to-touch, and further from everything else.
    const p = progressFor([], "Your");
    expect(p.next?.missing.length).toBe(
      Math.min(...p.milestones.filter((m) => !m.met).map((m) => m.missing.length)),
    );
  });

  it("offers nothing next once every claim is true", () => {
    const all = artifact.sections.flatMap(sectionFields).map((f) => f.id);
    const p = progressFor(answered(all), "Your");
    expect(p.next).toBeNull();
    expect(p.met).toHaveLength(milestoneSet.milestones.length);
  });

  it("says whose family it is", () => {
    expect(progressFor([], "Your").milestones[0].says).toMatch(/^Your family/);
    expect(progressFor([], "Margaret's").milestones[0].says).toMatch(/^Margaret's family/);
  });

  it("reads as one line, whatever the yaml did with the wrapping", () => {
    for (const m of progressFor([], "Your").milestones) {
      expect(m.says).not.toMatch(/\n|\s{2,}/);
      expect(m.says.endsWith(".")).toBe(true);
    }
  });
});

describe("harvestOf", () => {
  const item = (partial: Partial<CapturedItem> & { kind: CapturedItem["kind"] }): CapturedItem => ({
    label: "x",
    detail: null,
    fieldId: null,
    entityId: null,
    text: null,
    attributes: null,
    ...partial,
  });

  it("counts nothing from nothing", () => {
    expect(harvestOf([])).toEqual({ recorded: 0, people: 0, entries: 0, gaps: 0, notes: 0 });
  });

  it("counts a person once however many times they came up", () => {
    const h = harvestOf([
      item({ kind: "entity", fieldId: "s3.key_people", entityId: "p1" }),
      item({ kind: "entity", fieldId: "s3.household", entityId: "p1" }),
      item({ kind: "entity", fieldId: "s3.key_people", entityId: "p2" }),
    ]);
    expect(h.people).toBe(2);
    expect(h.entries).toBe(0);
    // Each row is still something recorded: the same person under two fields
    // is two facts about the document.
    expect(h.recorded).toBe(3);
  });

  it("keeps an account apart from a person", () => {
    const h = harvestOf([
      item({ kind: "entity", fieldId: "s5.accounts", entityId: "a1" }),
      item({ kind: "amount", fieldId: "s5.balances", entityId: "a1" }),
      item({ kind: "entity", fieldId: "s3.key_people", entityId: "p1" }),
    ]);
    expect(h.entries).toBe(1);
    expect(h.people).toBe(1);
  });

  it("counts a gap as its own thing rather than as something recorded", () => {
    const h = harvestOf([item({ kind: "gap", fieldId: "s1.do_not_yet" })]);
    expect(h.gaps).toBe(1);
    expect(h.recorded).toBe(0);
  });

  it("counts a note separately, since no field covered it", () => {
    const h = harvestOf([item({ kind: "note" }), item({ kind: "field", fieldId: "s1.do_not_yet" })]);
    expect(h.notes).toBe(1);
    expect(h.recorded).toBe(1);
  });
});
