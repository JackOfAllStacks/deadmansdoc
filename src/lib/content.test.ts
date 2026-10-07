import { describe, expect, it } from "vitest";
import { artifact, contentProblems, milestoneSet, questionBank, sessionTemplate } from "./content";
import type { MilestoneSet } from "./content";
import type { SessionTemplate } from "./plan/template";

const withSittings = (edit: (t: SessionTemplate) => void): SessionTemplate => {
  const copy = structuredClone(sessionTemplate);
  edit(copy);
  return copy;
};

const withMilestones = (edit: (m: MilestoneSet) => void): MilestoneSet => {
  const copy = structuredClone(milestoneSet);
  edit(copy);
  return copy;
};

/** Everything but the one thing a test is breaking. */
const found = (
  a = artifact,
  b = questionBank,
  t: SessionTemplate = sessionTemplate,
  m: MilestoneSet = milestoneSet,
) => contentProblems(a, b, t, m);

describe("contentProblems", () => {
  it("finds nothing wrong with the committed data", () => {
    expect(found()).toEqual([]);
  });

  it("flags a field covered by two sittings", () => {
    const t = withSittings((t) => t.sittings[1].covers.push("s1.first_calls"));
    expect(found(artifact, questionBank, t)).toContain(
      'field s1.first_calls is covered by both "people" and "first-days"',
    );
  });

  it("flags a field no sitting covers", () => {
    const t = withSittings((t) => {
      t.sittings[0].covers = t.sittings[0].covers.filter((id) => id !== "s1.fallback_contact");
    });
    expect(found(artifact, questionBank, t)).toContain(
      "field s1.fallback_contact isn't covered by any sitting",
    );
  });

  it("flags unknown ids, sitting keys and signals", () => {
    const t = withSittings((t) => {
      t.sittings[0].covers.push("s9.nope");
      (t.sittings[0].rules[0] as { when: string }).when = "pet_count";
      (t.sittings[3] as { key: string }).key = "pets";
    });
    const problems = found(artifact, questionBank, t);
    expect(problems).toContain('sitting "people" covers unknown id s9.nope');
    expect(problems).toContain('sitting "people" has a rule on unknown signal "pet_count"');
    expect(problems).toContain('sitting "pets" isn\'t a known sitting key');
    expect(problems).toContain('sitting "money-in-owed" is missing from the session template');
  });

  it("flags a topic that claims a field its sitting doesn't cover", () => {
    const t = withSittings((t) => t.sittings[0].topics[0].covers.push("s2.deadlines"));
    expect(found(artifact, questionBank, t)).toContain(
      'topic "Who to ring first" claims s2.deadlines, which "people" doesn\'t cover',
    );
  });

  it("flags a field the topics leave out, so nothing is covered unannounced", () => {
    const t = withSittings((t) => {
      t.sittings[0].topics[0].covers = t.sittings[0].topics[0].covers.filter(
        (id) => id !== "s1.fallback_contact",
      );
    });
    expect(found(artifact, questionBank, t)).toContain(
      'field s1.fallback_contact isn\'t in any topic of "people"',
    );
  });

  it("flags a field claimed by two topics of the same sitting", () => {
    const t = withSittings((t) => t.sittings[0].topics[1].covers.push("s1.first_calls"));
    expect(found(artifact, questionBank, t)).toContain(
      'field s1.first_calls is in both "Who to ring first" and "Who\'s around"',
    );
  });

  it("still flags a question pointing at a missing field", () => {
    const bank = structuredClone(questionBank);
    bank.questions[0].fills = ["s1.nope"];
    expect(found(artifact, bank)).toContain(
      `question ${bank.questions[0].id} fills unknown field s1.nope`,
    );
  });

  it("flags a milestone that claims something off a field that doesn't exist", () => {
    const m = withMilestones((m) => m.milestones[0].needs.push("s9.invented"));
    expect(found(artifact, questionBank, sessionTemplate, m)).toContain(
      'milestone "who-to-ring" needs unknown field s9.invented',
    );
  });

  it("flags a milestone resting on a sealed field, which the family can't read yet", () => {
    const m = withMilestones((m) => m.milestones[0].needs.push("s3.anticipated_disagreement"));
    expect(found(artifact, questionBank, sessionTemplate, m)).toContain(
      'milestone "who-to-ring" needs s3.anticipated_disagreement, which is sealed',
    );
  });

  it("flags a milestone that needs nothing, since it would always read as true", () => {
    const m = withMilestones((m) => (m.milestones[0].needs = []));
    expect(found(artifact, questionBank, sessionTemplate, m).join()).toContain("is always true");
  });

  it("flags a milestone that never says whose family it is about", () => {
    const m = withMilestones((m) => (m.milestones[0].says = "Everything is fine."));
    expect(found(artifact, questionBank, sessionTemplate, m)).toContain(
      'milestone "who-to-ring" never says whose family it is about',
    );
  });

  it("flags two milestones sharing an id", () => {
    const m = withMilestones((m) => m.milestones.push(structuredClone(m.milestones[0])));
    expect(found(artifact, questionBank, sessionTemplate, m)).toContain(
      "duplicate milestone id who-to-ring",
    );
  });
});
