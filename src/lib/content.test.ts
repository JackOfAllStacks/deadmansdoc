import { describe, expect, it } from "vitest";
import { artifact, contentProblems, questionBank, sessionTemplate } from "./content";
import type { SessionTemplate } from "./plan/template";

const withSittings = (edit: (t: SessionTemplate) => void): SessionTemplate => {
  const copy = structuredClone(sessionTemplate);
  edit(copy);
  return copy;
};

describe("contentProblems", () => {
  it("finds nothing wrong with the committed data", () => {
    expect(contentProblems(artifact, questionBank, sessionTemplate)).toEqual([]);
  });

  it("flags a field covered by two sittings", () => {
    const t = withSittings((t) => t.sittings[1].covers.push("s1.first_calls"));
    expect(contentProblems(artifact, questionBank, t)).toContain(
      'field s1.first_calls is covered by both "people" and "first-days"',
    );
  });

  it("flags a field no sitting covers", () => {
    const t = withSittings((t) => {
      t.sittings[0].covers = t.sittings[0].covers.filter((id) => id !== "s1.fallback_contact");
    });
    expect(contentProblems(artifact, questionBank, t)).toContain(
      "field s1.fallback_contact isn't covered by any sitting",
    );
  });

  it("flags unknown ids, sitting keys and signals", () => {
    const t = withSittings((t) => {
      t.sittings[0].covers.push("s9.nope");
      (t.sittings[0].rules[0] as { when: string }).when = "pet_count";
      (t.sittings[3] as { key: string }).key = "pets";
    });
    const problems = contentProblems(artifact, questionBank, t);
    expect(problems).toContain('sitting "people" covers unknown id s9.nope');
    expect(problems).toContain('sitting "people" has a rule on unknown signal "pet_count"');
    expect(problems).toContain('sitting "pets" isn\'t a known sitting key');
    expect(problems).toContain('sitting "money-in-owed" is missing from the session template');
  });

  it("still flags a question pointing at a missing field", () => {
    const bank = structuredClone(questionBank);
    bank.questions[0].fills = ["s1.nope"];
    expect(contentProblems(artifact, bank, sessionTemplate)).toContain(
      `question ${bank.questions[0].id} fills unknown field s1.nope`,
    );
  });
});
