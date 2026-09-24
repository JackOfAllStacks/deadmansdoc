import Anthropic from "@anthropic-ai/sdk";
import {
  appendIntakeMessage,
  completeIntake,
  intakeMessages,
  saveIntakeSignals,
  speakersFor,
  type MessageRow,
  type RecordRow,
} from "@/lib/records";
import { logFailure } from "@/lib/errors";
import { contextBlock, SYSTEM_PROMPT, WRAP_UP } from "./prompt";
import { applySignalUpdate, finishSchema, signalUpdateSchema, toToolSchema, type Signals } from "./signals";

type MessageParam = Anthropic.Beta.BetaMessageParam;
type ContentBlockParam = Anthropic.Beta.BetaContentBlockParam;
type ToolResult = Anthropic.Beta.BetaToolResultBlockParam;

export const MODEL = "claude-opus-5";
export const MAX_USER_TURNS = 12;
export const MAX_MESSAGE_LENGTH = 2000;
const MAX_CALLS_PER_TURN = 3;

export type IntakeEvent =
  | { type: "text"; text: string }
  // The model's reply is being regenerated; discard what was shown so far.
  | { type: "reset" }
  // The opening conversation is over; the plan comes next.
  | { type: "done" }
  // The reply is complete; waiting for the person.
  | { type: "end" }
  // kept: whether the person's message was saved. If not, it can be sent again.
  | { type: "error"; message: string; kept: boolean };

let anthropic: Anthropic | undefined;
const client = () => (anthropic ??= new Anthropic());

// eager_input_streaming is deliberately off. These inputs are tiny, so
// streaming them early gains nothing, and with it on the API stops enforcing
// the strict schema (a run produced "\"2-4\"" for an enum). The zod check
// below stays as a backstop.
const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "record_intake",
    description:
      "Record what the person's latest message told you about the planning topics. " +
      "Use null for anything that message didn't tell you; known values are kept.",
    input_schema: toToolSchema(signalUpdateSchema),
    strict: true,
  },
  {
    name: "finish_intake",
    description: "End the opening conversation once the picture is rough but complete, or the person wants to stop.",
    input_schema: toToolSchema(finishSchema),
    strict: true,
  },
];

function toApiMessages(record: RecordRow, history: MessageRow[]): MessageParam[] {
  const context: ContentBlockParam = { type: "text", text: contextBlock(record, speakersFor(record)) };
  return history.map((m, i) => ({
    role: m.role === "agent" ? "assistant" : "user",
    content: i === 0 ? [context, ...m.blocks] : m.blocks,
  }));
}

async function callModel(
  messages: MessageParam[],
  onText: (delta: string) => void,
  onRetry: () => void,
  recordId: string,
): Promise<Anthropic.Beta.BetaMessage> {
  for (let attempt = 0; ; attempt++) {
    const stream = client().beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      cache_control: { type: "ephemeral" },
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });
    stream.on("text", onText);
    try {
      const message = await stream.finalMessage();
      const u = message.usage;
      console.log(
        JSON.stringify({
          event: "intake_model_call",
          record: recordId,
          model: message.model,
          stop: message.stop_reason,
          input: u.input_tokens,
          output: u.output_tokens,
          cache_read: u.cache_read_input_tokens,
          cache_write: u.cache_creation_input_tokens,
        }),
      );
      return message;
    } catch (err) {
      // Only an unparseable tool input is worth one retry; API errors aren't.
      if (err instanceof Anthropic.APIError || attempt >= 1) throw err;
      console.error("intake: tool input could not be parsed, retrying", err);
      onRetry();
    }
  }
}

function toolError(id: string, message: string): ToolResult {
  return { type: "tool_result", tool_use_id: id, is_error: true, content: message };
}

function friendlyError(err: unknown): string {
  if (err instanceof Anthropic.RateLimitError || (err instanceof Anthropic.APIError && err.status === 529)) {
    return "The service is busy right now. Please wait a moment and send that again.";
  }
  return "Something went wrong on our side, so that message wasn't saved. Please send it again.";
}

export async function runIntakeTurn(
  record: RecordRow,
  speaker: string,
  text: string,
  send: (event: IntakeEvent) => void,
): Promise<void> {
  const startedAt = Date.now();
  // Showing the reply must never be what breaks saving it.
  const emit = (event: IntakeEvent) => {
    try {
      send(event);
    } catch (err) {
      console.error("intake: could not send event", err);
    }
  };

  const userMessage: MessageRow = {
    role: speaker === record.subject_name ? "subject" : "helper",
    content: text,
    blocks: [{ type: "text", text: `${speaker}: ${text}` }],
  };
  const history = [...(await intakeMessages(record.id)), userMessage];
  const userTurns = history.filter((m) => m.role === "subject" || m.role === "helper").length;
  const lastTurn = userTurns >= MAX_USER_TURNS;

  const messages = toApiMessages(record, history);
  if (lastTurn) messages.push({ role: "system", content: WRAP_UP });

  let signals: Signals = record.intake ?? {};
  let finished = false;
  let userSaved = false;
  let shownText = false;

  try {
    for (let call = 0; call < MAX_CALLS_PER_TURN && !finished; call++) {
      let separated = !shownText;
      const message = await callModel(
        messages,
        (delta) => {
          if (!separated) {
            emit({ type: "text", text: "\n\n" });
            separated = true;
          }
          shownText = true;
          emit({ type: "text", text: delta });
        },
        () => {
          shownText = false;
          separated = true;
          emit({ type: "reset" });
        },
        record.id,
      );

      if (message.stop_reason === "refusal") {
        emit({ type: "reset" });
        emit({
          type: "error",
          message: "I can't help with that part here. Could you put it another way, or tell me about something else on the list?",
          kept: false,
        });
        return;
      }

      const toolUses = message.content.filter((b) => b.type === "tool_use");
      if (message.stop_reason === "max_tokens" && toolUses.length) {
        throw new Error("intake: tool input cut off at max_tokens");
      }

      if (!userSaved) {
        await appendIntakeMessage(record.id, userMessage);
        userSaved = true;
      }
      const replyText = message.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
      await appendIntakeMessage(record.id, {
        role: "agent",
        content: replyText,
        blocks: message.content as ContentBlockParam[],
      });
      messages.push({ role: "assistant", content: message.content as ContentBlockParam[] });

      if (!toolUses.length) break;

      const results: ToolResult[] = [];
      for (const tool of toolUses) {
        if (tool.name === "record_intake") {
          const parsed = signalUpdateSchema.safeParse(tool.input);
          if (!parsed.success) {
            results.push(toolError(tool.id, `Input didn't match the schema: ${parsed.error.message}`));
            continue;
          }
          const next = applySignalUpdate(signals, parsed.data);
          if (typeof next === "string") {
            results.push(toolError(tool.id, next));
            continue;
          }
          signals = next;
          results.push({ type: "tool_result", tool_use_id: tool.id, content: "Recorded." });
        } else if (tool.name === "finish_intake") {
          const parsed = finishSchema.safeParse(tool.input);
          if (parsed.success) signals = { ...signals, summary: parsed.data.summary };
          finished = true;
          results.push({ type: "tool_result", tool_use_id: tool.id, content: "Finished." });
        } else {
          results.push(toolError(tool.id, `There is no tool called ${tool.name}.`));
        }
      }

      await appendIntakeMessage(record.id, { role: "tool", content: "", blocks: results });
      messages.push({ role: "user", content: results });
      await saveIntakeSignals(record.id, signals);

      // The reply is written before the tool call, so the turn is normally
      // over here. Go round again only if nothing has been said this turn, or
      // a tool call failed and the model needs to see why.
      const failed = results.some((r) => r.is_error);
      if (shownText && !failed) break;
    }
  } catch (err) {
    await logFailure({
      context: "intake:turn",
      error: err,
      recordId: record.id,
      userId: record.owner_user_id,
      model: MODEL,
      startedAt,
    });
    // If the reply was already saved it stays on screen and the conversation
    // can carry on; if not, nothing from this message was kept.
    if (!userSaved) emit({ type: "reset" });
    emit({
      type: "error",
      message: userSaved
        ? "Something went wrong partway through that reply. Please carry on, or send that again."
        : friendlyError(err),
      kept: userSaved,
    });
    return;
  }

  if (finished || lastTurn) {
    await completeIntake(record.id, signals);
    emit({ type: "done" });
  } else {
    emit({ type: "end" });
  }
}
