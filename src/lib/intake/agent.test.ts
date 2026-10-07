import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MessageRow, RecordRow, SittingRow } from "@/lib/records";

type Reply = {
  text?: string;
  tools?: { name: string; input: unknown }[];
  stop?: string;
  throws?: Error;
};

const state = vi.hoisted(() => ({
  replies: [] as Reply[],
  requests: [] as { messages: { role: string; content: unknown }[] }[],
  saved: [] as MessageRow[],
  signals: [] as unknown[],
  completed: [] as unknown[],
  history: [] as MessageRow[],
  sittings: [] as SittingRow[],
  revisions: [] as unknown[][],
}));

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status = 500;
  }
  class RateLimitError extends APIError {
    status = 429;
  }
  class Anthropic {
    static APIError = APIError;
    static RateLimitError = RateLimitError;
    beta = {
      messages: {
        stream: (params: { messages: { role: string; content: unknown }[] }) => {
          state.requests.push({ messages: structuredClone(params.messages) });
          const reply = state.replies.shift() ?? { text: "(no reply scripted)" };
          const listeners: ((t: string) => void)[] = [];
          return {
            on: (_: string, fn: (t: string) => void) => listeners.push(fn),
            finalMessage: async () => {
              if (reply.throws) throw reply.throws;
              if (reply.text) for (const fn of listeners) fn(reply.text);
              const content = [
                ...(reply.text ? [{ type: "text", text: reply.text }] : []),
                ...(reply.tools ?? []).map((t, i) => ({ type: "tool_use", id: `tool_${i}`, name: t.name, input: t.input })),
              ];
              return {
                model: "claude-opus-5",
                content,
                stop_reason: reply.stop ?? (reply.tools?.length ? "tool_use" : "end_turn"),
                usage: { input_tokens: 1, output_tokens: 1 },
              };
            },
          };
        },
      },
    };
  }
  return { default: Anthropic };
});

vi.mock("@/lib/records", () => ({
  intakeMessages: async () => structuredClone(state.history),
  appendIntakeMessage: async (_: string, m: MessageRow) => void state.saved.push(m),
  saveIntakeSignals: async (_: string, s: unknown) => void state.signals.push(s),
  completeIntake: async (_: string, s: unknown) => void state.completed.push(s),
  speakersFor: (r: RecordRow) => [r.subject_name, ...r.present.filter((n) => n !== r.subject_name)],
  listSittings: async () => structuredClone(state.sittings),
  applyRevision: async (_: string, revisions: unknown[]) => void state.revisions.push(revisions),
}));

const { runIntakeTurn, MAX_USER_TURNS } = await import("./agent");
import type { IntakeEvent } from "./agent";

const record: RecordRow = {
  id: "rec-1",
  owner_user_id: "user-1",
  subject_name: "Margaret",
  subject_relationship: "parent",
  intake: { family_count: 2 },
  intake_completed_at: null,
  present: ["Priya", "Margaret"],
};

const signals = (overrides: Record<string, unknown> = {}) => ({
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
  ...overrides,
});

// The mocked SDK error classes take just a message.
const mockError = (cls: unknown, message: string) => new (cls as new (m: string) => Error)(message);

async function turn(text = "Hello", speaker = "Priya") {
  const events: IntakeEvent[] = [];
  await runIntakeTurn(record, speaker, text, (e) => events.push(e));
  return events;
}

beforeEach(() => {
  state.replies = [];
  state.requests = [];
  state.saved = [];
  state.signals = [];
  state.completed = [];
  state.history = [];
  state.sittings = [];
  state.revisions = [];
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("runIntakeTurn", () => {
  it("streams a plain reply and saves both sides", async () => {
    state.replies = [{ text: "Thank you. How many accounts?" }];
    const events = await turn("Two children");
    expect(events).toEqual([{ type: "text", text: "Thank you. How many accounts?" }, { type: "end" }]);
    expect(state.saved.map((m) => m.role)).toEqual(["helper", "agent"]);
    expect(state.saved[0].blocks).toEqual([{ type: "text", text: "Priya: Two children" }]);
    expect(state.requests).toHaveLength(1);
  });

  it("labels the subject's own messages", async () => {
    state.replies = [{ text: "Thanks." }];
    await turn("I have two children", "Margaret");
    expect(state.saved[0].role).toBe("subject");
  });

  it("puts the context block ahead of the first message only", async () => {
    state.history = [
      { role: "subject", content: "Hi", blocks: [{ type: "text", text: "Margaret: Hi" }] },
      { role: "agent", content: "Hello", blocks: [{ type: "text", text: "Hello" }] },
    ];
    state.replies = [{ text: "Right." }];
    await turn();
    const [first, second, third] = state.requests[0].messages as { content: { text: string }[] }[];
    expect(first.content[0].text).toMatch(/^<context>/);
    expect(first.content[1].text).toBe("Margaret: Hi");
    expect(second.content[0].text).toBe("Hello");
    expect(third.content).toEqual([{ type: "text", text: "Priya: Hello" }]);
  });

  it("records signals and ends the turn in one call when the reply came first", async () => {
    state.replies = [
      {
        text: "Thank you.",
        tools: [{ name: "record_intake", input: signals({ adviser_count: 2, mentioned_sittings: ["money-out"] }) }],
      },
    ];
    const events = await turn();
    expect(state.requests).toHaveLength(1);
    expect(events.at(-1)).toEqual({ type: "end" });
    expect(state.saved.map((m) => m.role)).toEqual(["helper", "agent", "tool"]);
    expect(state.signals.at(-1)).toEqual({ family_count: 2, adviser_count: 2, front_of_mind: ["money-out"] });
  });

  it("goes round again when a tool was called without saying anything", async () => {
    state.replies = [
      { tools: [{ name: "record_intake", input: signals({ family_count: 3 }) }] },
      { text: "And who else?" },
    ];
    const events = await turn();
    expect(state.requests).toHaveLength(2);
    expect(events).toEqual([{ type: "text", text: "And who else?" }, { type: "end" }]);
    const lastRequest = state.requests[1].messages;
    expect(lastRequest.at(-1)).toMatchObject({ role: "user", content: [{ type: "tool_result", content: "Recorded." }] });
  });

  it("returns schema failures to the model and lets it try again", async () => {
    state.replies = [
      { text: "Noted.", tools: [{ name: "record_intake", input: { family_count: "lots" } }] },
      { tools: [{ name: "record_intake", input: signals({ family_count: 5 }) }] },
    ];
    const events = await turn();
    expect(state.requests).toHaveLength(2);
    const firstResult = state.requests[1].messages.at(-1)!.content as { is_error?: boolean }[];
    expect(firstResult[0].is_error).toBe(true);
    expect(state.signals.at(-1)).toEqual({ family_count: 5 });
    expect(events.at(-1)).toEqual({ type: "end" });
  });

  it("rejects out-of-range counts without storing them", async () => {
    state.replies = [
      { text: "Noted.", tools: [{ name: "record_intake", input: signals({ family_count: -4 }) }] },
      { text: "Sorry, could you tell me again?" },
    ];
    await turn();
    expect(state.signals[0]).toEqual({ family_count: 2 });
  });

  it("finishes the conversation and keeps the summary", async () => {
    state.replies = [
      {
        text: "Thank you both. Your plan comes next.",
        tools: [
          { name: "record_intake", input: signals({ has_income_after_death: true }) },
          { name: "finish_intake", input: { summary: "A pension continues." } },
        ],
      },
    ];
    const events = await turn();
    expect(events.at(-1)).toEqual({ type: "done", revised: 0 });
    expect(state.completed).toEqual([{ family_count: 2, has_income_after_death: true, summary: "A pension continues." }]);
    expect(state.requests).toHaveLength(1);
  });

  it("re-cuts only the sittings not yet started when the conversation is reopened", async () => {
    // A plan already exists: one sitting done, two still untouched.
    state.sittings = [
      { id: "s1", seq: 1, title: "The people around you", sitting_key: "people", estimated_minutes: 15, scheduled_for: "2026-10-01", status: "done" },
      { id: "s2", seq: 2, title: "The first days and weeks", sitting_key: "first-days", estimated_minutes: 15, scheduled_for: "2026-10-08", status: "planned" },
      { id: "s3", seq: 3, title: "Money going out", sitting_key: "money-out", estimated_minutes: 15, scheduled_for: "2026-10-15", status: "planned" },
    ];
    state.replies = [
      {
        text: "Noted — I've taken that into account.",
        tools: [
          { name: "record_intake", input: signals({ mentioned_sittings: ["money-out"] }) },
          { name: "finish_intake", input: { summary: "Money is the worry." } },
        ],
      },
    ];

    const events = await turn();
    expect(events.at(-1)).toEqual({ type: "done", revised: 2 });

    const [revision] = state.revisions as { id: string; seq: number; date: string }[][];
    // Money moved to the front of what's left, and took the earlier slot with
    // it. The finished sitting was never in the revision at all.
    expect(revision.map((r) => r.id)).toEqual(["s3", "s2"]);
    expect(revision.map((r) => [r.seq, r.date])).toEqual([
      [2, "2026-10-08"],
      [3, "2026-10-15"],
    ]);
  });

  it("finishes after the last allowed turn even if the model doesn't", async () => {
    state.history = Array.from({ length: MAX_USER_TURNS - 1 }, (_, i) => [
      { role: "subject" as const, content: `m${i}`, blocks: [{ type: "text" as const, text: `Margaret: m${i}` }] },
      { role: "agent" as const, content: "ok", blocks: [{ type: "text" as const, text: "ok" }] },
    ]).flat();
    state.replies = [{ text: "Thank you." }];
    const events = await turn();
    expect(state.requests[0].messages.at(-1)).toMatchObject({ role: "system" });
    expect(events.at(-1)).toEqual({ type: "done", revised: 0 });
    expect(state.completed).toHaveLength(1);
  });

  it("doesn't add the wrap-up before the last turn", async () => {
    state.replies = [{ text: "Thank you." }];
    await turn();
    expect(state.requests[0].messages.some((m) => m.role === "system")).toBe(false);
  });

  it("saves nothing when the model refuses", async () => {
    state.replies = [{ text: "partial", stop: "refusal" }];
    const events = await turn();
    expect(state.saved).toEqual([]);
    expect(events.at(-1)).toMatchObject({ type: "error", kept: false });
    expect(events).toContainEqual({ type: "reset" });
  });

  it("saves nothing when a tool input was cut off", async () => {
    state.replies = [{ text: "Hi", tools: [{ name: "record_intake", input: signals() }], stop: "max_tokens" }];
    const events = await turn();
    expect(state.saved).toEqual([]);
    expect(events.at(-1)).toMatchObject({ type: "error", kept: false });
  });

  it("saves nothing and says so when the API fails", async () => {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    state.replies = [{ throws: mockError(Anthropic.RateLimitError, "slow down") }];
    const events = await turn();
    expect(state.saved).toEqual([]);
    expect(events.at(-1)).toMatchObject({ type: "error", kept: false, message: expect.stringMatching(/busy/) });
    expect(state.requests).toHaveLength(1);
  });

  it("retries once when a tool input couldn't be parsed, discarding what was shown", async () => {
    state.replies = [{ text: "Half a reply", throws: new SyntaxError("bad json") }, { text: "Full reply" }];
    const events = await turn();
    expect(state.requests).toHaveLength(2);
    expect(events).toContainEqual({ type: "reset" });
    expect(state.saved.at(-1)).toMatchObject({ role: "agent", content: "Full reply" });
  });

  it("keeps the saved reply on screen when a later step fails", async () => {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    state.replies = [
      { tools: [{ name: "record_intake", input: signals() }] },
      { throws: mockError(Anthropic.APIError, "boom") },
    ];
    const events = await turn();
    expect(state.saved.map((m) => m.role)).toEqual(["helper", "agent", "tool"]);
    expect(events).not.toContainEqual({ type: "reset" });
    expect(events.at(-1)).toMatchObject({ type: "error", kept: true });
  });

  it("still saves the reply when the person's connection has gone", async () => {
    state.replies = [{ text: "Thank you." }];
    await runIntakeTurn(record, "Priya", "Hello", () => {
      throw new Error("stream closed");
    });
    expect(state.saved.map((m) => m.role)).toEqual(["helper", "agent"]);
  });

  it("answers an unknown tool with an error", async () => {
    state.replies = [
      { text: "Hmm.", tools: [{ name: "delete_everything", input: {} }] },
      { text: "Sorry about that." },
    ];
    await turn();
    const result = state.requests[1].messages.at(-1)!.content as { is_error?: boolean }[];
    expect(result[0].is_error).toBe(true);
  });

  it("separates text from consecutive calls", async () => {
    state.replies = [
      { text: "First.", tools: [{ name: "record_intake", input: { bad: true } }] },
      { text: "Second." },
    ];
    const events = await turn();
    expect(events.filter((e) => e.type === "text").map((e) => (e as { text: string }).text).join("")).toBe(
      "First.\n\nSecond.",
    );
  });
});
