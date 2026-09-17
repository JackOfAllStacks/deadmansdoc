import { describe, expect, it } from "vitest";
import { accessCodeMatches } from "./access-code";

describe("accessCodeMatches", () => {
  it("accepts the configured code", () => {
    expect(accessCodeMatches("family-2026", "family-2026")).toBe(true);
  });

  it("ignores surrounding whitespace from a pasted code", () => {
    expect(accessCodeMatches("  family-2026\n", "family-2026")).toBe(true);
  });

  it("rejects a wrong code, including one of a different length", () => {
    expect(accessCodeMatches("family-2025", "family-2026")).toBe(false);
    expect(accessCodeMatches("f", "family-2026")).toBe(false);
    expect(accessCodeMatches("family-2026-and-more", "family-2026")).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(accessCodeMatches("FAMILY-2026", "family-2026")).toBe(false);
  });

  it("rejects a missing code", () => {
    expect(accessCodeMatches(undefined, "family-2026")).toBe(false);
    expect(accessCodeMatches(null, "family-2026")).toBe(false);
    expect(accessCodeMatches("", "family-2026")).toBe(false);
  });

  it("rejects everything when no code is configured", () => {
    expect(accessCodeMatches("anything", undefined)).toBe(false);
    expect(accessCodeMatches("", "")).toBe(false);
  });
});
