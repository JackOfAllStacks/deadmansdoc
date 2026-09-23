import { describe, expect, it } from "vitest";
import { applySignalUpdate, finishSchema, signalUpdateSchema, toToolSchema, type SignalUpdate } from "./signals";

const empty: SignalUpdate = {
  family_count: null,
  adviser_count: null,
  account_band: null,
  runs_household_money_alone: null,
  has_business_or_trust: null,
  has_debts_or_guarantees: null,
  has_income_after_death: null,
  has_time_constrained_rites: null,
  has_matters_in_progress: null,
  mentioned_sittings: [],
};

describe("signalUpdateSchema", () => {
  it("accepts an update where nothing is known yet", () => {
    expect(signalUpdateSchema.safeParse(empty).success).toBe(true);
  });

  it("rejects wrong types, unknown keys and missing keys", () => {
    expect(signalUpdateSchema.safeParse({ ...empty, family_count: "three" }).success).toBe(false);
    expect(signalUpdateSchema.safeParse({ ...empty, family_count: 2.5 }).success).toBe(false);
    expect(signalUpdateSchema.safeParse({ ...empty, account_band: "lots" }).success).toBe(false);
    expect(signalUpdateSchema.safeParse({ ...empty, mentioned_sittings: ["pets"] }).success).toBe(false);
    expect(signalUpdateSchema.safeParse({ ...empty, balance: 1000 }).success).toBe(false);
    const missing: Partial<SignalUpdate> = { ...empty };
    delete missing.family_count;
    expect(signalUpdateSchema.safeParse(missing).success).toBe(false);
  });
});

describe("applySignalUpdate", () => {
  it("keeps known values when an update says null", () => {
    const next = applySignalUpdate({ family_count: 4, has_business_or_trust: true }, empty);
    expect(next).toEqual({ family_count: 4, has_business_or_trust: true });
  });

  it("overwrites with newly learned values, including false and zero", () => {
    const next = applySignalUpdate(
      { family_count: 4, has_business_or_trust: true },
      { ...empty, family_count: 0, has_business_or_trust: false, account_band: "2-4" },
    );
    expect(next).toEqual({ family_count: 0, has_business_or_trust: false, account_band: "2-4" });
  });

  it("records topics in the order they were first raised, without repeats", () => {
    let signals = applySignalUpdate({}, { ...empty, mentioned_sittings: ["money-in-owed"] });
    signals = applySignalUpdate(signals as object, { ...empty, mentioned_sittings: ["people", "money-in-owed"] });
    expect(signals).toEqual({ front_of_mind: ["money-in-owed", "people"] });
  });

  it("rejects counts out of range", () => {
    expect(applySignalUpdate({}, { ...empty, family_count: -1 })).toMatch(/family_count/);
    expect(applySignalUpdate({}, { ...empty, adviser_count: 5000 })).toMatch(/adviser_count/);
  });
});

describe("toToolSchema", () => {
  it("produces a strict-compatible object schema", () => {
    for (const schema of [signalUpdateSchema, finishSchema]) {
      const json = toToolSchema(schema) as Record<string, unknown>;
      expect(json.type).toBe("object");
      expect(json.additionalProperties).toBe(false);
      expect(json).not.toHaveProperty("$schema");
      expect([...(json.required as string[])].sort()).toEqual(Object.keys(json.properties as object).sort());
      expect(JSON.stringify(json)).not.toMatch(/"(minimum|maximum)"/);
    }
  });
});
