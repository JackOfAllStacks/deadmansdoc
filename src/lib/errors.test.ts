import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

const query = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: () => query }));

const { classifyFailure, failureMessage, logFailure } = await import("@/lib/errors");

function apiError(status: number | undefined) {
  return new Anthropic.APIError(status, undefined, "boom", undefined);
}

describe("classifyFailure", () => {
  it.each([
    [429, "rate_limit"],
    [529, "overloaded"],
    [401, "auth"],
    [403, "auth"],
    [404, "not_found"],
    [400, "bad_request"],
    [422, "bad_request"],
    [500, "server_error"],
    [503, "server_error"],
  ])("maps HTTP %i to %s", (status, expected) => {
    expect(classifyFailure(apiError(status)).type).toBe(expected);
  });

  it("treats an API error that never got a status as a network failure", () => {
    expect(classifyFailure(apiError(undefined))).toEqual({ type: "network_error", status: null });
  });

  it("treats anything else as our own bug", () => {
    expect(classifyFailure(new Error("undefined is not a function"))).toEqual({
      type: "app_error",
      status: null,
    });
    expect(classifyFailure("just a string").type).toBe("app_error");
  });
});

describe("failureMessage", () => {
  it("reads an Error's message", () => {
    expect(failureMessage(new Error("nope"))).toBe("nope");
  });

  it("stringifies anything else", () => {
    expect(failureMessage({ toString: () => "odd" })).toBe("odd");
  });
});

describe("logFailure", () => {
  it("writes one row with the classified type and duration", async () => {
    query.mockReset().mockResolvedValue([]);
    await logFailure({
      context: "intake:turn",
      error: apiError(429),
      recordId: "r1",
      userId: "u1",
      model: "claude-opus-5",
      startedAt: Date.now() - 1500,
    });

    expect(query).toHaveBeenCalledTimes(1);
    const values = query.mock.calls[0].slice(1);
    expect(values).toContain("r1");
    expect(values).toContain("u1");
    expect(values).toContain("intake:turn");
    expect(values).toContain("rate_limit");
    expect(values).toContain(429);
    const duration = values.find((v) => typeof v === "number" && v >= 1500 && v < 60_000);
    expect(duration).toBeDefined();
  });

  it("never throws when the database is unreachable", async () => {
    query.mockReset().mockRejectedValue(new Error("no connection"));
    await expect(logFailure({ context: "intake:turn", error: new Error("x") })).resolves.toBeUndefined();
  });

  it("truncates a huge provider message", async () => {
    query.mockReset().mockResolvedValue([]);
    await logFailure({ context: "intake:turn", error: new Error("x".repeat(9000)) });
    const message = query.mock.calls[0].slice(1).find((v) => typeof v === "string" && v.startsWith("xxx"));
    expect(message).toHaveLength(4000);
  });
});
