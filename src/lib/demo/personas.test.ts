import { describe, expect, it } from "vitest";
import { fieldsById, sessionTemplate } from "@/lib/content";
import { personaProblems, personas, type Persona } from "./personas";

const base = (): Persona => structuredClone(personas[0]);

describe("the personas we ship", () => {
  it("has some", () => {
    expect(personas.length).toBeGreaterThan(0);
  });

  it("finds nothing wrong with any of them", () => {
    expect(personas.flatMap(personaProblems)).toEqual([]);
  });

  it("gives every persona a full plan, so the plan page is never half-built", () => {
    for (const persona of personas) {
      expect(persona.sittings.map((s) => s.key).sort()).toEqual(
        sessionTemplate.sittings.map((s) => s.key).sort(),
      );
    }
  });

  it("never puts a figure anywhere it would print in the Guide", () => {
    for (const persona of personas) {
      for (const row of persona.record ?? []) {
        if (row.amount) expect(fieldsById.get(row.field)?.disclosure).toBe("sealed");
      }
    }
  });

  it("shows both kinds of gap, since a demo should cover the one nobody can answer", () => {
    const gaps = personas.flatMap((p) => (p.record ?? []).filter((r) => r.unknown !== undefined));
    expect(gaps.some((r) => typeof r.unknown === "string")).toBe(true);
    expect(gaps.some((r) => r.unknown === true)).toBe(true);
  });

  it("offers at least one finished record and one still in progress", () => {
    const statuses = personas.map((p) => p.sittings.map((s) => s.status));
    expect(statuses.some((s) => s.every((x) => x === "done"))).toBe(true);
    expect(statuses.some((s) => s.includes("in_progress") || s.includes("planned"))).toBe(true);
  });
});

describe("personaProblems", () => {
  it("catches a field that doesn't exist", () => {
    const p = base();
    p.record = [{ field: "s9.invented", value: "x" }];
    expect(personaProblems(p).join()).toContain("records unknown field s9.invented");
  });

  it("accepts a gap nobody has been named for, with a priority on it", () => {
    const p = base();
    p.record = [{ field: "s3.advisers", unknown: true, priority: "high" }];
    expect(personaProblems(p)).toEqual([]);
  });

  it("catches a gap whose name is blank, which is neither one thing nor the other", () => {
    const p = base();
    p.record = [{ field: "s3.advisers", unknown: "" }];
    expect(personaProblems(p).join()).toContain("empty name against its gap");
  });

  it("catches a figure on a field that isn't sealed, which would leak it", () => {
    const p = base();
    p.record = [{ field: "s5.accounts", entity: p.entities![0].label, amount: "$10" }];
    expect(personaProblems(p).join()).toContain("would print in the Guide");
  });

  it("catches an entity nobody defined", () => {
    const p = base();
    p.record = [{ field: "s3.key_people", entity: "Nobody At All" }];
    expect(personaProblems(p).join()).toContain("isn't in its entities");
  });

  it("catches a missing sitting", () => {
    const p = base();
    p.sittings = p.sittings.filter((s) => s.key !== "money-out");
    expect(personaProblems(p).join()).toContain('is missing sitting "money-out"');
  });

  it("catches a row with nothing recorded against it", () => {
    const p = base();
    p.record = [{ field: "s3.interrelationships" }];
    expect(personaProblems(p).join()).toContain("has nothing recorded against it");
  });
});
