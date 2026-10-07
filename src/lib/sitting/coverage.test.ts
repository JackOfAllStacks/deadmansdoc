import { describe, expect, it } from "vitest";
import { sessionTemplate } from "@/lib/content";
import {
  coverageOf,
  remainingQuestions,
  sittingFields,
  topicProgress,
  topicsFor,
} from "@/lib/sitting/coverage";
import type { FilledField } from "@/lib/sitting/capture";

const covers = (key: string) => sessionTemplate.sittings.find((s) => s.key === key)!.covers;
const answered = (...ids: string[]): FilledField[] => ids.map((field_id) => ({ field_id, status: "answered" }));

describe("sittingFields", () => {
  it("expands a section into its fields", () => {
    const ids = sittingFields(covers("people")).map((f) => f.id);
    expect(ids).toContain("s3.key_people");
    expect(ids).toContain("s1.first_calls");
  });

  it("expands a group without pulling in the rest of its section", () => {
    const ids = sittingFields(covers("money-out")).map((f) => f.id);
    expect(ids).toContain("s5.regular_bills");
    expect(ids).not.toContain("s5.mortgage_loans_cards");
  });

  it("gives every sitting some ground to cover, and never the same field twice", () => {
    const seen = new Set<string>();
    for (const sitting of sessionTemplate.sittings) {
      const ids = sittingFields(sitting.covers).map((f) => f.id);
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
    }
  });
});

describe("remainingQuestions", () => {
  it("only offers questions that fill what this sitting covers", () => {
    const mine = new Set(sittingFields(covers("people")).map((f) => f.id));
    for (const q of remainingQuestions(covers("people"), [])) {
      expect(q.fills.some((id) => mine.has(id))).toBe(true);
    }
  });

  it("puts the highest priority first", () => {
    const priorities = remainingQuestions(covers("people"), [], 20).map((q) => q.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
  });

  it("drops a question once something it fills has been answered", () => {
    const before = remainingQuestions(covers("people"), [], 50);
    const target = before.find((q) => q.fills.includes("s3.key_people"))!;
    const after = remainingQuestions(covers("people"), answered("s3.key_people"), 50);
    expect(before.map((q) => q.id)).toContain(target.id);
    expect(after.map((q) => q.id)).not.toContain(target.id);
  });

  it("drops a question when its field was a recorded gap, so it isn't asked twice", () => {
    const gap: FilledField[] = [{ field_id: "s3.key_people", status: "unknown" }];
    const after = remainingQuestions(covers("people"), gap, 50);
    expect(after.every((q) => !q.fills.includes("s3.key_people"))).toBe(true);
  });

  it("honours the limit", () => {
    expect(remainingQuestions(covers("people"), [], 3)).toHaveLength(3);
  });

  it("runs out once everything the sitting covers is settled", () => {
    const all = answered(...sittingFields(covers("money-in-owed")).map((f) => f.id));
    expect(remainingQuestions(covers("money-in-owed"), all, 50)).toEqual([]);
  });
});

describe("coverageOf", () => {
  it("counts answers and gaps apart, and ignores other sittings' fields", () => {
    const filled: FilledField[] = [
      { field_id: "s3.key_people", status: "answered" },
      { field_id: "s3.advisers", status: "unknown" },
      { field_id: "s5.regular_bills", status: "answered" },
    ];
    const out = coverageOf(covers("people"), filled);
    expect(out.answered).toBe(1);
    expect(out.gaps).toBe(1);
    expect(out.total).toBe(sittingFields(covers("people")).length);
    expect(out.outstanding.map((f) => f.id)).not.toContain("s3.key_people");
  });
});

describe("topicProgress", () => {
  const topics = topicsFor("people");

  it("gives every sitting plain-language areas to show", () => {
    for (const sitting of sessionTemplate.sittings) {
      expect(topicsFor(sitting.key).length).toBeGreaterThan(0);
    }
  });

  it("starts with nothing ticked and nothing started", () => {
    const progress = topicProgress(topics, []);
    expect(progress.every((t) => !t.started && !t.done)).toBe(true);
    expect(progress.map((t) => t.answered)).toEqual(topics.map(() => 0));
  });

  it("marks an area as started as soon as anything under it lands", () => {
    const [first] = topics;
    const progress = topicProgress(topics, answered(first.covers[0]));
    expect(progress[0]).toMatchObject({ started: true, done: false, answered: 1 });
    expect(progress[1].started).toBe(false);
  });

  it("counts a gap as settling a field, because it is an answer too", () => {
    const [first] = topics;
    const filled: FilledField[] = first.covers.map((field_id, i) => ({
      field_id,
      status: i === 0 ? "unknown" : "answered",
    }));
    const progress = topicProgress(topics, filled);
    expect(progress[0]).toMatchObject({ done: true, gaps: 1, answered: first.covers.length - 1 });
  });

  it("ignores fields belonging to another sitting", () => {
    const progress = topicProgress(topics, answered("s5.regular_bills"));
    expect(progress.every((t) => !t.started)).toBe(true);
  });
});
