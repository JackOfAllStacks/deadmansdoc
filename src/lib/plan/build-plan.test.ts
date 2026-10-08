import { describe, expect, it } from "vitest";
import { sessionTemplate } from "@/lib/content";
import type { Signals } from "@/lib/intake/signals";
import {
  buildPlan,
  formatMinutes,
  orderSittings,
  reorderSlots,
  reviseRemaining,
  sittingMinutes,
  totalMinutes,
  type ExistingSitting,
  type ReorderRow,
} from "./build-plan";
import type { SessionTemplate } from "./template";

const template: SessionTemplate = {
  version: 1,
  max_minutes_per_sitting: 30,
  round_to_minutes: 5,
  sittings: [
    {
      key: "people",
      title: "People",
      summary: "",
      topics: [],
      default_order: 1,
      covers: [],
      base_minutes: 15,
      rules: [{ when: "family_count", over: 3, each: 2, cap: 10, unknown: 4 }],
    },
    {
      key: "first-days",
      title: "First days",
      summary: "",
      topics: [],
      default_order: 2,
      covers: [],
      base_minutes: 15,
      rules: [{ when: "has_time_constrained_rites", is: true, add: 5, unknown: false }],
    },
    {
      key: "money-out",
      title: "Money out",
      summary: "",
      topics: [],
      default_order: 3,
      covers: [],
      base_minutes: 12,
      rules: [{ when: "account_band", is: "5+", add: 30, unknown: "2-4" }],
    },
    {
      key: "money-in-owed",
      title: "Money in",
      summary: "",
      topics: [],
      default_order: 4,
      covers: [],
      base_minutes: 10,
      rules: [],
    },
  ],
};

const byKey = (key: string) => template.sittings.find((s) => s.key === key)!;

describe("sittingMinutes", () => {
  it("adds per-unit time above the threshold", () => {
    expect(sittingMinutes(byKey("people"), { family_count: 3 })).toBe(15);
    expect(sittingMinutes(byKey("people"), { family_count: 6 })).toBe(21);
  });

  it("caps per-unit time", () => {
    expect(sittingMinutes(byKey("people"), { family_count: 40 })).toBe(25);
  });

  it("uses the rule's assumed value when a signal is unknown", () => {
    expect(sittingMinutes(byKey("people"), {})).toBe(17);
    expect(sittingMinutes(byKey("first-days"), {})).toBe(15);
  });

  it("adds time only when a match rule matches", () => {
    expect(sittingMinutes(byKey("first-days"), { has_time_constrained_rites: true })).toBe(20);
    expect(sittingMinutes(byKey("first-days"), { has_time_constrained_rites: false })).toBe(15);
    expect(sittingMinutes(byKey("money-out"), { account_band: "5+" })).toBe(42);
    expect(sittingMinutes(byKey("money-out"), { account_band: "0-1" })).toBe(12);
  });
});

describe("orderSittings", () => {
  it("uses the default order when nothing came up unprompted", () => {
    expect(orderSittings(template, {}).map((s) => s.key)).toEqual([
      "people",
      "first-days",
      "money-out",
      "money-in-owed",
    ]);
  });

  it("puts front-of-mind topics first, in the order they were raised", () => {
    const signals: Signals = { front_of_mind: ["money-in-owed", "first-days"] };
    expect(orderSittings(template, signals).map((s) => s.key)).toEqual([
      "money-in-owed",
      "first-days",
      "people",
      "money-out",
    ]);
  });
});

describe("buildPlan", () => {
  it("rounds each sitting to the nearest step", () => {
    const plan = buildPlan({ family_count: 6 }, template);
    expect(plan.map((s) => s.minutes)).toEqual([20, 15, 10, 10]);
  });

  it("never rounds a sitting down to nothing", () => {
    const tiny = { ...template, sittings: [{ ...byKey("money-in-owed"), base_minutes: 1 }] };
    expect(buildPlan({}, tiny)[0].minutes).toBe(5);
  });

  it("splits a sitting over the maximum into parts", () => {
    const plan = buildPlan({ account_band: "5+" }, template);
    const money = plan.filter((s) => s.key === "money-out");
    expect(money.map((s) => s.title)).toEqual(["Money out (part 1 of 2)", "Money out (part 2 of 2)"]);
    expect(money.map((s) => s.minutes)).toEqual([20, 20]);
    expect(plan).toHaveLength(5);
  });

  it("has no dates: people choose when", () => {
    for (const sitting of buildPlan({}, template)) expect(sitting).not.toHaveProperty("date");
  });

  it("keeps the summary and covers from the template", () => {
    const real = buildPlan({}, sessionTemplate);
    expect(real).toHaveLength(sessionTemplate.sittings.length);
    for (const sitting of real) {
      expect(sitting.summary).not.toBe("");
      expect(sitting.covers.length).toBeGreaterThan(0);
    }
  });

  it("keeps the real template's sittings within the maximum for typical households", () => {
    const busy: Signals = {
      family_count: 8,
      adviser_count: 4,
      account_band: "5+",
      runs_household_money_alone: true,
      has_business_or_trust: true,
      has_debts_or_guarantees: true,
      has_income_after_death: true,
      has_time_constrained_rites: true,
      has_matters_in_progress: true,
    };
    for (const sitting of buildPlan(busy, sessionTemplate)) {
      expect(sitting.minutes).toBeLessThanOrEqual(sessionTemplate.max_minutes_per_sitting);
    }
  });
});

describe("time helpers", () => {
  it("formats totals", () => {
    expect(totalMinutes([{ minutes: 25 }, { minutes: 50 }])).toBe(75);
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 hr");
    expect(formatMinutes(95)).toBe("1 hr 35 min");
  });
});

describe("reviseRemaining", () => {
  const existing = (
    rows: [id: string, seq: number, key: string, status: string][],
  ): ExistingSitting[] =>
    rows.map(([id, seq, sitting_key, status]) => ({
      id,
      seq,
      sitting_key,
      status: status as ExistingSitting["status"],
    }));

  const plan = existing([
    ["a", 1, "people", "done"],
    ["b", 2, "first-days", "planned"],
    ["c", 3, "money-out", "planned"],
    ["d", 4, "money-in-owed", "planned"],
  ]);

  it("never touches a sitting that has been started", () => {
    const ids = reviseRemaining(plan, { front_of_mind: ["people"] }, template).map((r) => r.id);
    expect(ids).not.toContain("a");
    expect(ids.sort()).toEqual(["b", "c", "d"]);
  });

  it("reorders what's left within the places it already had", () => {
    const revised = reviseRemaining(plan, { front_of_mind: ["money-in-owed"] }, template);
    // The money sitting is now first of what's left, so it takes the earliest
    // slot, and the slots themselves are exactly the ones already in the plan.
    expect(revised.map((r) => r.id)).toEqual(["d", "b", "c"]);
    expect(revised.map((r) => r.seq)).toEqual([2, 3, 4]);
  });

  it("re-estimates from the new answers", () => {
    const before = reviseRemaining(plan, {}, template).find((r) => r.id === "b")!;
    const after = reviseRemaining(plan, { has_time_constrained_rites: true }, template).find(
      (r) => r.id === "b",
    )!;
    expect(after.minutes).toBe(before.minutes + 5);
  });

  it("does nothing when every sitting has been started", () => {
    const started = existing([
      ["a", 1, "people", "done"],
      ["b", 2, "first-days", "in_progress"],
    ]);
    expect(reviseRemaining(started, {}, template)).toEqual([]);
  });

  it("leaves a plan alone rather than guess how to re-cut a split sitting", () => {
    const split = existing([
      ["a", 1, "money-out", "planned"],
      ["b", 2, "money-out", "planned"],
    ]);
    expect(reviseRemaining(split, {}, template)).toEqual([]);
  });
});

describe("reorderSlots", () => {
  const rows = (
    list: [id: string, seq: number, status: string][],
  ): ReorderRow[] =>
    list.map(([id, seq, status]) => ({
      id,
      seq,
      sitting_key: id,
      status: status as ReorderRow["status"],
      title: `Sitting ${id}`,
      estimated_minutes: 15,
    }));

  const plan = rows([
    ["a", 1, "done"],
    ["b", 2, "planned"],
    ["c", 3, "planned"],
    ["d", 4, "planned"],
  ]);

  it("moves a sitting into the slot it was dropped on", () => {
    const moved = reorderSlots(plan, ["d", "b", "c"]);
    expect(moved.map((r) => [r.id, r.seq])).toEqual([
      ["d", 2],
      ["b", 3],
      ["c", 4],
    ]);
  });

  it("leaves what has been started where it is", () => {
    expect(reorderSlots(plan, ["d", "b", "c"]).map((r) => r.id)).not.toContain("a");
  });

  it("keeps each sitting's own title and estimate", () => {
    const moved = reorderSlots(plan, ["d", "b", "c"]);
    expect(moved[0]).toMatchObject({ title: "Sitting d", minutes: 15 });
  });

  it("moves nothing when the order isn't the movable sittings exactly", () => {
    expect(reorderSlots(plan, ["b", "c"])).toEqual([]);
    expect(reorderSlots(plan, ["b", "c", "a"])).toEqual([]);
    expect(reorderSlots(plan, ["b", "c", "c"])).toEqual([]);
    expect(reorderSlots(plan, ["b", "c", "zzz"])).toEqual([]);
  });
});
