import { describe, expect, it } from "vitest";
import { countLooseEnds, groupLooseEnds, type LooseEnd } from "@/lib/artifact/gaps";

function end(partial: Partial<LooseEnd> & { fieldId: string }): LooseEnd {
  return {
    label: partial.fieldId,
    sectionTitle: "A section",
    type: "text",
    note: null,
    whoWouldKnow: null,
    priority: null,
    sittingKey: null,
    order: 0,
    ...partial,
  };
}

describe("groupLooseEnds", () => {
  it("puts everything routed to one person in one group", () => {
    const groups = groupLooseEnds([
      end({ fieldId: "a", whoWouldKnow: "Peter" }),
      end({ fieldId: "b", whoWouldKnow: "Robyn" }),
      end({ fieldId: "c", whoWouldKnow: "Peter" }),
    ]);
    expect(groups.map((g) => [g.who, g.ends.length])).toEqual([
      ["Peter", 2],
      ["Robyn", 1],
    ]);
  });

  it("treats one person spelled two ways as one errand", () => {
    const groups = groupLooseEnds([
      end({ fieldId: "a", whoWouldKnow: "Peter" }),
      end({ fieldId: "b", whoWouldKnow: "peter" }),
    ]);
    expect(groups).toHaveLength(1);
    // The spelling that arrived first is the one the heading uses.
    expect(groups[0].who).toBe("Peter");
  });

  it("orders inside a group by what matters, then by template order", () => {
    const groups = groupLooseEnds([
      end({ fieldId: "late-low", whoWouldKnow: "Peter", priority: "low", order: 9 }),
      end({ fieldId: "early-none", whoWouldKnow: "Peter", priority: null, order: 1 }),
      end({ fieldId: "late-high", whoWouldKnow: "Peter", priority: "high", order: 8 }),
      end({ fieldId: "early-medium", whoWouldKnow: "Peter", priority: "medium", order: 2 }),
    ]);
    expect(groups[0].ends.map((e) => e.fieldId)).toEqual([
      "late-high",
      "early-medium",
      "late-low",
      // No priority sorts last, not first: an unranked gap isn't an urgent one.
      "early-none",
    ]);
  });

  it("orders two things in the template's order when they matter the same", () => {
    const groups = groupLooseEnds([
      end({ fieldId: "second", whoWouldKnow: "Peter", priority: "high", order: 5 }),
      end({ fieldId: "first", whoWouldKnow: "Peter", priority: "high", order: 3 }),
    ]);
    expect(groups[0].ends.map((e) => e.fieldId)).toEqual(["first", "second"]);
  });

  it("leads with the group holding the most pressing thing", () => {
    const groups = groupLooseEnds([
      end({ fieldId: "a", whoWouldKnow: "Robyn", priority: "low" }),
      end({ fieldId: "b", whoWouldKnow: "Robyn", priority: "low" }),
      end({ fieldId: "c", whoWouldKnow: "Peter", priority: "high" }),
    ]);
    // Three things for Robyn is the bigger errand; one urgent thing for Peter
    // still comes first.
    expect(groups.map((g) => g.who)).toEqual(["Peter", "Robyn"]);
  });

  it("prefers the bigger errand when nothing is more pressing", () => {
    const groups = groupLooseEnds([
      end({ fieldId: "a", whoWouldKnow: "Peter", priority: "medium" }),
      end({ fieldId: "b", whoWouldKnow: "Robyn", priority: "medium" }),
      end({ fieldId: "c", whoWouldKnow: "Robyn", priority: "medium" }),
    ]);
    expect(groups.map((g) => g.who)).toEqual(["Robyn", "Peter"]);
  });

  it("always leaves the ones nobody is named for last", () => {
    const groups = groupLooseEnds([
      // Unrouted and urgent, against routed and trivial: it still goes last,
      // because it is what the page should leave you looking at.
      end({ fieldId: "a", whoWouldKnow: null, priority: "high" }),
      end({ fieldId: "b", whoWouldKnow: null, priority: "high" }),
      end({ fieldId: "c", whoWouldKnow: "Peter", priority: "low" }),
    ]);
    expect(groups.map((g) => g.who)).toEqual(["Peter", null]);
    expect(groups[1].ends).toHaveLength(2);
  });

  it("gives an empty record no groups", () => {
    expect(groupLooseEnds([])).toEqual([]);
  });
});

describe("countLooseEnds", () => {
  it("counts the total, the ones with somebody to ask, and the pressing ones", () => {
    expect(
      countLooseEnds([
        end({ fieldId: "a", whoWouldKnow: "Peter", priority: "high" }),
        end({ fieldId: "b", whoWouldKnow: "Peter", priority: "low" }),
        end({ fieldId: "c", priority: "high" }),
        end({ fieldId: "d" }),
      ]),
    ).toEqual({ total: 4, routed: 2, pressing: 2 });
  });

  it("counts nothing as nothing", () => {
    expect(countLooseEnds([])).toEqual({ total: 0, routed: 0, pressing: 0 });
  });
});
