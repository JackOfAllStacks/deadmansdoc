import { describe, expect, it } from "vitest";
import { sessionTemplate } from "@/lib/content";
import type { Signals } from "@/lib/intake/signals";
import { addDays, buildPlan, formatMinutes, isIsoDate, orderSittings, sittingMinutes, totalMinutes } from "./build-plan";
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
      default_order: 1,
      covers: [],
      base_minutes: 15,
      rules: [{ when: "family_count", over: 3, each: 2, cap: 10, unknown: 4 }],
    },
    {
      key: "first-days",
      title: "First days",
      summary: "",
      default_order: 2,
      covers: [],
      base_minutes: 15,
      rules: [{ when: "has_time_constrained_rites", is: true, add: 5, unknown: false }],
    },
    {
      key: "money-out",
      title: "Money out",
      summary: "",
      default_order: 3,
      covers: [],
      base_minutes: 12,
      rules: [{ when: "account_band", is: "5+", add: 30, unknown: "2-4" }],
    },
    {
      key: "money-in-owed",
      title: "Money in",
      summary: "",
      default_order: 4,
      covers: [],
      base_minutes: 10,
      rules: [],
    },
  ],
};

const start = { startDate: "2026-09-21", rhythm: "weekly" as const };
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
    const plan = buildPlan({ family_count: 6 }, template, start);
    expect(plan.map((s) => s.minutes)).toEqual([20, 15, 10, 10]);
  });

  it("never rounds a sitting down to nothing", () => {
    const tiny = { ...template, sittings: [{ ...byKey("money-in-owed"), base_minutes: 1 }] };
    expect(buildPlan({}, tiny, start)[0].minutes).toBe(5);
  });

  it("splits a sitting over the maximum into parts", () => {
    const plan = buildPlan({ account_band: "5+" }, template, start);
    const money = plan.filter((s) => s.key === "money-out");
    expect(money.map((s) => s.title)).toEqual(["Money out (part 1 of 2)", "Money out (part 2 of 2)"]);
    expect(money.map((s) => s.minutes)).toEqual([20, 20]);
    expect(plan).toHaveLength(5);
  });

  it("schedules weekly from the start date", () => {
    expect(buildPlan({}, template, start).map((s) => s.date)).toEqual([
      "2026-09-21",
      "2026-09-28",
      "2026-10-05",
      "2026-10-12",
    ]);
  });

  it("schedules fortnightly", () => {
    expect(buildPlan({}, template, { ...start, rhythm: "fortnightly" }).map((s) => s.date)).toEqual([
      "2026-09-21",
      "2026-10-05",
      "2026-10-19",
      "2026-11-02",
    ]);
  });

  it("schedules twice a week on alternating gaps", () => {
    expect(buildPlan({}, template, { ...start, rhythm: "twice-weekly" }).map((s) => s.date)).toEqual([
      "2026-09-21",
      "2026-09-24",
      "2026-09-28",
      "2026-10-01",
    ]);
  });

  it("rolls over months and years", () => {
    const plan = buildPlan({}, template, { startDate: "2026-12-24", rhythm: "weekly" });
    expect(plan.map((s) => s.date)).toEqual(["2026-12-24", "2026-12-31", "2027-01-07", "2027-01-14"]);
  });

  it("rejects an invalid start date", () => {
    expect(() => buildPlan({}, template, { ...start, startDate: "2026-02-30" })).toThrow();
    expect(() => buildPlan({}, template, { ...start, startDate: "21/09/2026" })).toThrow();
  });

  it("keeps the summary and covers from the template", () => {
    const real = buildPlan({}, sessionTemplate, start);
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
    for (const sitting of buildPlan(busy, sessionTemplate, start)) {
      expect(sitting.minutes).toBeLessThanOrEqual(sessionTemplate.max_minutes_per_sitting);
    }
  });
});

describe("date and time helpers", () => {
  it("adds days across month ends and leap days", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("recognises real dates only", () => {
    expect(isIsoDate("2026-09-21")).toBe(true);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-9-21")).toBe(false);
  });

  it("formats totals", () => {
    expect(totalMinutes([{ minutes: 25 }, { minutes: 50 }])).toBe(75);
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 hr");
    expect(formatMinutes(95)).toBe("1 hr 35 min");
  });
});
