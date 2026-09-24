import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: () => query }));

const { setRole } = await import("@/lib/admin");

// The tagged-template call comes through as (strings, ...values); the SQL is
// what the strings join to.
const sqlOf = (call: unknown[]) => (call[0] as string[]).join("?").replace(/\s+/g, " ").trim();

beforeEach(() => query.mockReset());

describe("setRole", () => {
  it("grants admin", async () => {
    query.mockResolvedValueOnce([{ email: "santi@example.test", role: "admin" }]);
    await expect(setRole("me", "them", "admin")).resolves.toEqual({
      ok: true,
      email: "santi@example.test",
      role: "admin",
    });
    expect(sqlOf(query.mock.calls[0])).toContain("set role = 'admin'");
  });

  it("removes admin when someone else still has it", async () => {
    query.mockResolvedValueOnce([{ email: "santi@example.test", role: "user" }]);
    await expect(setRole("me", "them", "user")).resolves.toMatchObject({ ok: true, role: "user" });
    // The update only applies if another admin exists, in the same statement.
    expect(sqlOf(query.mock.calls[0])).toContain("exists (select 1 from \"user\" other where other.role = 'admin'");
  });

  it("won't remove the last admin", async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ role: "admin" }]);
    await expect(setRole("me", "them", "user")).resolves.toEqual({
      ok: false,
      reason: "That's the last admin. Make someone else an admin first.",
    });
  });

  it("says so when the account has gone", async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await expect(setRole("me", "them", "user")).resolves.toEqual({
      ok: false,
      reason: "That account no longer exists.",
    });
  });

  it("won't let anyone change their own access", async () => {
    await expect(setRole("me", "me", "user")).resolves.toEqual({
      ok: false,
      reason: "You can't change your own access. Ask another admin.",
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("won't let anyone grant themselves admin either", async () => {
    await expect(setRole("me", "me", "admin")).resolves.toMatchObject({ ok: false });
    expect(query).not.toHaveBeenCalled();
  });
});
