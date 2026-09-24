import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MessageRow, RecordRow } from "@/lib/records";
import type { SittingDetail } from "@/lib/sitting/store";

type Reply = { text?: string; tools?: { name: string; input: unknown }[]; stop?: string; throws?: Error };

const state = vi.hoisted(() => ({
  replies: [] as Reply[],
  requests: [] as { system: unknown; messages: { role: string; content: unknown }[] }[],
  messages: [] as MessageRow[],
  history: [] as MessageRow[],
  fields: [] as unknown[],
  entities: [] as unknown[],
  amounts: [] as unknown[],
  gaps: [] as unknown[],
  notes: [] as unknown[],
  completed: [] as { summary: string }[],
  asks: [] as unknown[],
  known: [] as { id: string; entityType: string; label: string }[],
  gapApplies: true,
  filled: [] as { field_id: string; status: string }[],
  failures: [] as unknown[],
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
        stream: (params: { system: unknown; messages: { role: string; content: unknown }[] }) => {
          state.requests.push({ system: params.system, messages: structuredClone(params.messages) });
          const reply = state.replies.shift() ?? { text: "(no reply scripted)" };
          const listeners: ((t: string) => void)[] = [];
          return {
            on: (_: string, fn: (t: string) => void) => listeners.push(fn),
            finalMessage: async () => {
              if (reply.throws) throw reply.throws;
              if (reply.text) for (const fn of listeners) fn(reply.text);
              return {
                model: "claude-opus-5",
                content: [
                  ...(reply.text ? [{ type: "text", text: reply.text }] : []),
                  ...(reply.tools ?? []).map((t, i) => ({
                    type: "tool_use",
                    id: `tool_${i}`,
                    name: t.name,
                    input: t.input,
                  })),
                ],
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

vi.mock("@/lib/sitting/store", () => ({
  sittingMessages: async () => structuredClone(state.history),
  appendSittingMessage: async (_r: string, _s: string, m: MessageRow) => {
    state.messages.push(m);
    return `msg_${state.messages.length}`;
  },
  completeSitting: async (_r: string, _s: string, summary: string) => void state.completed.push({ summary }),
  recordQuestionAsks: async (_r: string, _s: string, asks: unknown) => void state.asks.push(asks),
}));

vi.mock("@/lib/sitting/capture", () => ({
  knownEntities: async () => structuredClone(state.known),
  filledFields: async () => structuredClone(state.filled),
  saveFieldValue: async (_r: string, c: unknown) => void state.fields.push(c),
  saveEntity: async (_r: string, c: { label: string; entityType: string }) => {
    state.entities.push(c);
    return `ent_${state.entities.length}`;
  },
  saveAmount: async (_r: string, c: unknown) => void state.amounts.push(c),
  saveGap: async (_r: string, c: unknown) => {
    state.gaps.push(c);
    return state.gapApplies;
  },
  saveNote: async (_r: string, _s: string, c: unknown) => void state.notes.push(c),
}));

vi.mock("@/lib/errors", () => ({
  logFailure: async (f: unknown) => void state.failures.push(f),
}));

const { runSittingTurn, MAX_USER_TURNS, minutesLeftOf } = await import("./agent");
import type { SittingEvent } from "./agent";

const record: RecordRow = {
  id: "rec-1",
  owner_user_id: "user-1",
  subject_name: "John",
  subject_relationship: "parent",
  intake: { summary: "Semi-retired builder, company and a trust." },
  intake_completed_at: "2026-09-01T00:00:00Z",
  present: ["Jack", "John"],
};

const sitting: SittingDetail = {
  id: "sit-1",
  record_id: "rec-1",
  seq: 1,
  title: "The people around you",
  sitting_key: "people",
  covers: ["s3", "s1.first_calls", "s1.fallback_contact", "s1.routing_map"],
  estimated_minutes: 20,
  scheduled_for: "2026-10-01",
  status: "in_progress",
  started_at: new Date().toISOString(),
  summary: null,
  present: ["Jack", "John"],
  busy_until: null,
};

async function turn(text = "Priya is my daughter.", speaker = "Jack") {
  const events: SittingEvent[] = [];
  await runSittingTurn(record, sitting, speaker, text, (e) => events.push(e));
  return events;
}

beforeEach(() => {
  Object.assign(state, {
    replies: [],
    requests: [],
    messages: [],
    history: [],
    fields: [],
    entities: [],
    amounts: [],
    gaps: [],
    notes: [],
    completed: [],
    asks: [],
    known: [],
    filled: [],
    failures: [],
    gapApplies: true,
  });
});

describe("what the model is sent", () => {
  it("puts the changing state after the history, so the cached prefix holds", async () => {
    state.replies = [{ text: "Thanks." }];
    await turn();
    const { messages, system } = state.requests[0];
    expect(typeof system).toBe("string");
    expect(messages.at(-1)).toMatchObject({ role: "system" });
    expect(String(messages.at(-1)!.content)).toContain("<progress>");
    // The person's own message is still the last real turn before it.
    expect(messages.at(-2)).toMatchObject({ role: "user" });
  });

  it("offers questions that belong to this sitting", async () => {
    state.replies = [{ text: "Thanks." }];
    await turn();
    const progress = String(state.requests[0].messages.at(-1)!.content);
    expect(progress).toContain("Still worth covering");
  });

  it("tells the model to wrap up when the time is nearly gone", async () => {
    state.replies = [{ text: "Thanks." }];
    const nearlyOver = { ...sitting, started_at: new Date(Date.now() - 18 * 60_000).toISOString() };
    const events: SittingEvent[] = [];
    await runSittingTurn(record, nearlyOver, "Jack", "ok", (e) => events.push(e));
    const contents = state.requests[0].messages.map((m) => String(m.content));
    expect(contents.some((c) => c.includes("nearly up"))).toBe(true);
  });

  it("leaves the wrap-up out while there's time left", async () => {
    state.replies = [{ text: "Thanks." }];
    await turn();
    const contents = state.requests[0].messages.map((m) => String(m.content));
    expect(contents.some((c) => c.includes("nearly up"))).toBe(false);
  });
});

describe("recording what was said", () => {
  it("writes a field and tells the browser about it", async () => {
    state.replies = [
      {
        text: "Noted.",
        tools: [
          {
            name: "save_field",
            input: {
              field_id: "s3.interrelationships",
              text: "Dev lives in Perth and rarely visits.",
              items: null,
              people: null,
              family_action: "Ring Dev early; he's three hours away.",
              confidence: "stated",
              disclosure: null,
            },
          },
        ],
      },
    ];
    const events = await turn();
    expect(state.fields).toHaveLength(1);
    expect(events.find((e) => e.type === "saved")).toMatchObject({
      kind: "field",
      label: "How the key people relate to each other, and who has never met whom",
    });
    expect(events.some((e) => e.type === "progress")).toBe(true);
  });

  it("records a person and makes them available to point at straight away", async () => {
    state.replies = [
      {
        text: "Got it.",
        tools: [
          {
            name: "save_entity",
            input: {
              field_id: "s3.key_people",
              label: "Priya",
              attributes: [{ key: "relationship", value: "daughter" }],
              family_action: null,
              confidence: "stated",
            },
          },
          {
            name: "save_field",
            input: {
              field_id: "s3.financial_knower",
              text: null,
              items: null,
              people: ["Priya"],
              family_action: null,
              confidence: "stated",
              disclosure: null,
            },
          },
        ],
      },
    ];
    await turn();
    expect(state.entities).toHaveLength(1);
    // The second call in the same turn resolved against the person the first
    // one had just created.
    expect(state.fields).toHaveLength(1);
  });

  it("sends a bad tool call back to the model instead of failing the turn", async () => {
    state.replies = [
      {
        tools: [
          {
            name: "save_field",
            input: {
              field_id: "s3.interrelationships",
              text: null,
              items: ["a list where prose belongs"],
              people: null,
              family_action: null,
              confidence: "stated",
              disclosure: null,
            },
          },
        ],
      },
      { text: "Sorry, let me put that differently." },
    ];
    const events = await turn();
    expect(state.fields).toHaveLength(0);
    const toolMessage = state.messages.find((m) => m.role === "tool");
    expect(JSON.stringify(toolMessage!.blocks)).toContain("written as prose");
    // It went round again, and the person still got an answer.
    expect(events.filter((e) => e.type === "text").map((e) => e.text).join("")).toContain("differently");
  });

  it("records an 'I don't know' as a gap with who would know", async () => {
    state.replies = [
      {
        text: "That's fine.",
        tools: [
          {
            name: "flag_gap",
            input: {
              field_id: "s3.advisers",
              who_would_know: "Peter the accountant",
              priority: "medium",
              note: null,
            },
          },
        ],
      },
    ];
    const events = await turn();
    expect(state.gaps[0]).toMatchObject({ whoWouldKnow: "Peter the accountant", priority: "medium" });
    expect(events.find((e) => e.type === "saved")).toMatchObject({ kind: "gap", detail: "Peter the accountant" });
  });

  it("doesn't claim to have noted a gap on a field that already has an answer", async () => {
    state.gapApplies = false;
    state.replies = [
      {
        text: "Fair enough.",
        tools: [
          {
            name: "flag_gap",
            input: { field_id: "s3.advisers", who_would_know: "Peter", priority: "low", note: null },
          },
        ],
      },
    ];
    const events = await turn();
    expect(events.some((e) => e.type === "saved")).toBe(false);
    expect(JSON.stringify(state.messages.find((m) => m.role === "tool")!.blocks)).toContain("already has an answer");
  });

  it("refuses to attach a figure to something not yet recorded", async () => {
    state.replies = [
      {
        tools: [
          {
            name: "save_amount",
            input: {
              field_id: "s5.balances",
              entity_label: "NAB everyday",
              amount: "$4,000",
              confidence: "stated",
            },
          },
        ],
      },
      { text: "Let me note the account first." },
    ];
    await turn();
    expect(state.amounts).toHaveLength(0);
    expect(JSON.stringify(state.messages.find((m) => m.role === "tool")!.blocks)).toContain("Record it first");
  });
});

describe("ending", () => {
  it("finishes on finish_sitting and passes the summary back", async () => {
    state.replies = [
      {
        text: "Thank you both.",
        tools: [{ name: "finish_sitting", input: { summary: "Covered the family. Advisers still to confirm." } }],
      },
    ];
    const events = await turn();
    expect(state.completed[0].summary).toContain("Advisers still to confirm");
    expect(events.at(-1)).toMatchObject({ type: "done" });
  });

  it("ends the sitting itself once the turn cap is hit, whatever the model does", async () => {
    state.history = Array.from({ length: MAX_USER_TURNS }, () => ({
      role: "helper" as const,
      content: "Jack: something",
      blocks: [{ type: "text" as const, text: "Jack: something" }],
    }));
    state.replies = [{ text: "One more thing…" }];
    const events = await turn();
    expect(state.completed).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ type: "done" });
  });

  it("says 'end' and stays open while there's more to do", async () => {
    state.replies = [{ text: "And who else?" }];
    const events = await turn();
    expect(state.completed).toHaveLength(0);
    expect(events.at(-1)).toMatchObject({ type: "end" });
  });
});

describe("when things go wrong", () => {
  it("keeps a refusal off the screen and saves nothing", async () => {
    state.replies = [{ stop: "refusal" }];
    const events = await turn();
    expect(state.messages).toHaveLength(0);
    expect(events).toEqual([
      { type: "reset" },
      expect.objectContaining({ type: "error", kept: false }),
    ]);
  });

  it("logs a provider failure and doesn't keep the message", async () => {
    const { default: Anthropic } = (await import("@anthropic-ai/sdk")) as unknown as {
      default: { APIError: new (m: string) => Error };
    };
    state.replies = [{ throws: new Anthropic.APIError("boom") }];
    const events = await turn();
    expect(state.failures[0]).toMatchObject({ context: "sitting:turn", recordId: "rec-1" });
    expect(events.at(-1)).toMatchObject({ type: "error", kept: false });
    expect(state.messages).toHaveLength(0);
  });

  it("retries once when tool input can't be parsed, and clears what was shown", async () => {
    // Not an API error, so it's the parser that failed rather than the
    // provider -- worth one more go.
    state.replies = [{ throws: new Error("unterminated JSON") }, { text: "Right, let me try that again." }];
    const events = await turn();
    expect(events.some((e) => e.type === "reset")).toBe(true);
    expect(state.failures).toHaveLength(0);
    expect(events.at(-1)).toMatchObject({ type: "end" });
  });

  it("gives a gentler message when the service is busy", async () => {
    const { default: Anthropic } = (await import("@anthropic-ai/sdk")) as unknown as {
      default: { RateLimitError: new (m: string) => Error };
    };
    state.replies = [{ throws: new Anthropic.RateLimitError("slow down") }];
    const events = await turn();
    expect(events.at(-1)).toMatchObject({ type: "error", message: expect.stringContaining("busy") });
  });

  it("carries on saving even if the browser has gone", async () => {
    state.replies = [
      {
        text: "Noted.",
        tools: [
          {
            name: "save_field",
            input: {
              field_id: "s3.interrelationships",
              text: "They've never met.",
              items: null,
              people: null,
              family_action: null,
              confidence: "stated",
              disclosure: null,
            },
          },
        ],
      },
    ];
    await runSittingTurn(record, sitting, "Jack", "hello", () => {
      throw new Error("client gone");
    });
    expect(state.fields).toHaveLength(1);
    expect(state.messages.length).toBeGreaterThan(0);
  });
});

describe("minutesLeftOf", () => {
  it("counts down from the estimate once it has started", () => {
    const started = { ...sitting, started_at: new Date(Date.now() - 5 * 60_000).toISOString() };
    expect(minutesLeftOf(started)).toBeCloseTo(15, 0);
  });

  it("gives the whole estimate before it starts", () => {
    expect(minutesLeftOf({ ...sitting, started_at: null })).toBe(20);
  });
});
