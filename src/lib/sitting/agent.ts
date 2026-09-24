import Anthropic from "@anthropic-ai/sdk";
import { fieldsById, questionBank } from "@/lib/content";
import { logFailure } from "@/lib/errors";
import { speakersFor, type MessageRow, type RecordRow } from "@/lib/records";
import {
  filledFields,
  knownEntities,
  saveAmount,
  saveEntity,
  saveFieldValue,
  saveGap,
  saveNote,
  type FilledField,
} from "@/lib/sitting/capture";
import { coverageOf, remainingQuestions } from "@/lib/sitting/coverage";
import { contextBlock, LAST_TURN, stateBlock, SYSTEM_PROMPT, WRAP_UP } from "@/lib/sitting/prompt";
import {
  finishSittingSchema,
  flagGapSchema,
  saveAmountSchema,
  saveEntitySchema,
  saveFieldSchema,
  saveNoteSchema,
  toolsFor,
} from "@/lib/sitting/schema";
import {
  appendSittingMessage,
  completeSitting,
  recordQuestionAsks,
  sittingMessages,
  type SittingDetail,
} from "@/lib/sitting/store";
import { validateSaveAmount, validateSaveEntity, validateSaveField, type KnownEntity } from "@/lib/sitting/validate";

type MessageParam = Anthropic.Beta.BetaMessageParam;
type ContentBlockParam = Anthropic.Beta.BetaContentBlockParam;
type ToolResult = Anthropic.Beta.BetaToolResultBlockParam;

export const MODEL = "claude-opus-5";
export const MAX_MESSAGE_LENGTH = 4000;
// A generous ceiling on a half-hour conversation, not a target. The time-based
// wrap-up below is what normally ends a sitting.
export const MAX_USER_TURNS = 60;
const MAX_CALLS_PER_TURN = 4;
// Below this much of the sitting's time, the model is told to draw to a close.
const WRAP_UP_AT_MINUTES = 4;

export type SittingEvent =
  | { type: "text"; text: string }
  | { type: "reset" }
  // Something was written down; the panel beside the conversation shows these.
  | { type: "saved"; kind: "field" | "entity" | "amount" | "gap" | "note"; label: string; detail: string | null }
  | { type: "progress"; answered: number; gaps: number; total: number }
  | { type: "done"; summary: string }
  | { type: "end" }
  | { type: "error"; message: string; kept: boolean };

let anthropic: Anthropic | undefined;
const client = () => (anthropic ??= new Anthropic());

// eager_input_streaming stays off: with it on the API stops enforcing the
// strict schema, and these inputs are small enough that streaming them early
// would gain nothing.
const TOOLS = toolsFor() as Anthropic.Beta.BetaTool[];

function toApiMessages(record: RecordRow, sitting: SittingDetail, history: MessageRow[]): MessageParam[] {
  const context: ContentBlockParam = {
    type: "text",
    text: contextBlock(record, sitting, speakersFor(record)),
  };
  return history.map((m, i) => ({
    role: m.role === "agent" ? "assistant" : "user",
    content: i === 0 ? [context, ...m.blocks] : m.blocks,
  }));
}

export function minutesLeftOf(sitting: SittingDetail, now = Date.now()): number {
  if (!sitting.started_at) return sitting.estimated_minutes;
  const elapsed = (now - new Date(sitting.started_at).getTime()) / 60_000;
  return sitting.estimated_minutes - elapsed;
}

async function callModel(
  messages: MessageParam[],
  onText: (delta: string) => void,
  onRetry: () => void,
  sittingId: string,
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
          event: "sitting_model_call",
          sitting: sittingId,
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
      if (err instanceof Anthropic.APIError || attempt >= 1) throw err;
      console.error("sitting: tool input could not be parsed, retrying", err);
      onRetry();
    }
  }
}

const toolError = (id: string, message: string): ToolResult => ({
  type: "tool_result",
  tool_use_id: id,
  is_error: true,
  content: message,
});

const ok = (id: string, message: string): ToolResult => ({ type: "tool_result", tool_use_id: id, content: message });

function friendlyError(err: unknown): string {
  if (err instanceof Anthropic.RateLimitError || (err instanceof Anthropic.APIError && err.status === 529)) {
    return "The service is busy right now. Please wait a moment and send that again.";
  }
  return "Something went wrong on our side, so that message wasn't saved. Please send it again.";
}

const labelOf = (fieldId: string) => fieldsById.get(fieldId)?.label ?? fieldId;

interface TurnState {
  record: RecordRow;
  sitting: SittingDetail;
  known: KnownEntity[];
  touched: Set<string>;
  emit: (event: SittingEvent) => void;
}

// Runs one tool call and returns what the model should be told about it.
async function runTool(
  state: TurnState,
  name: string,
  input: unknown,
  messageId: string | null,
): Promise<{ result: string; failed: boolean; finished?: string }> {
  const { record, sitting, emit } = state;

  switch (name) {
    case "save_field": {
      const parsed = saveFieldSchema.safeParse(input);
      if (!parsed.success) return { result: `That didn't match the schema: ${parsed.error.message}`, failed: true };
      const capture = validateSaveField(parsed.data, state.known);
      if (typeof capture === "string") return { result: capture, failed: true };
      await saveFieldValue(record.id, capture, messageId);
      state.touched.add(capture.fieldId);
      emit({ type: "saved", kind: "field", label: labelOf(capture.fieldId), detail: capture.familyAction });
      return { result: "Recorded.", failed: false };
    }

    case "save_entity": {
      const parsed = saveEntitySchema.safeParse(input);
      if (!parsed.success) return { result: `That didn't match the schema: ${parsed.error.message}`, failed: true };
      const capture = validateSaveEntity(parsed.data);
      if (typeof capture === "string") return { result: capture, failed: true };
      const id = await saveEntity(record.id, capture, messageId);
      state.touched.add(capture.fieldId);
      if (!state.known.some((k) => k.id === id)) {
        state.known.push({ id, entityType: capture.entityType, label: capture.label });
      }
      emit({ type: "saved", kind: "entity", label: capture.label, detail: labelOf(capture.fieldId) });
      return { result: `Recorded ${capture.label}.`, failed: false };
    }

    case "save_amount": {
      const parsed = saveAmountSchema.safeParse(input);
      if (!parsed.success) return { result: `That didn't match the schema: ${parsed.error.message}`, failed: true };
      const capture = validateSaveAmount(parsed.data, state.known);
      if (typeof capture === "string") return { result: capture, failed: true };
      await saveAmount(record.id, capture, messageId);
      state.touched.add(capture.fieldId);
      emit({ type: "saved", kind: "amount", label: parsed.data.entity_label, detail: "sealed" });
      return { result: "Recorded, and sealed.", failed: false };
    }

    case "flag_gap": {
      const parsed = flagGapSchema.safeParse(input);
      if (!parsed.success) return { result: `That didn't match the schema: ${parsed.error.message}`, failed: true };
      const { field_id, who_would_know, priority, note } = parsed.data;
      if (!fieldsById.has(field_id)) return { result: `There is no field called ${field_id}.`, failed: true };
      await saveGap(record.id, { fieldId: field_id, whoWouldKnow: who_would_know, priority, note }, messageId);
      state.touched.add(field_id);
      emit({ type: "saved", kind: "gap", label: labelOf(field_id), detail: who_would_know });
      return { result: "Noted as unknown.", failed: false };
    }

    case "save_note": {
      const parsed = saveNoteSchema.safeParse(input);
      if (!parsed.success) return { result: `That didn't match the schema: ${parsed.error.message}`, failed: true };
      const { label, value, family_action, confidence } = parsed.data;
      await saveNote(
        record.id,
        sitting.id,
        { label, value, familyAction: family_action, confidence },
        messageId,
      );
      emit({ type: "saved", kind: "note", label, detail: null });
      return { result: "Kept.", failed: false };
    }

    case "finish_sitting": {
      const parsed = finishSittingSchema.safeParse(input);
      const summary = parsed.success ? parsed.data.summary : "";
      return { result: "Finished.", failed: false, finished: summary };
    }

    default:
      return { result: `There is no tool called ${name}.`, failed: true };
  }
}

// Questions the tools showed were covered, recorded once each, the first time
// the field they fill stops being outstanding.
function newlyCovered(touched: Set<string>, before: FilledField[]): { questionId: string; outcome: "answered" }[] {
  const settled = new Set(before.filter((f) => f.status !== "skipped").map((f) => f.field_id));
  const fresh = [...touched].filter((id) => !settled.has(id));
  const seen = new Set<string>();
  const asks: { questionId: string; outcome: "answered" }[] = [];
  for (const q of questionBank.questions) {
    if (seen.has(q.id)) continue;
    if (q.fills.some((id) => fresh.includes(id))) {
      seen.add(q.id);
      asks.push({ questionId: q.id, outcome: "answered" });
    }
  }
  return asks;
}

export async function runSittingTurn(
  record: RecordRow,
  sitting: SittingDetail,
  speaker: string,
  text: string,
  send: (event: SittingEvent) => void,
): Promise<void> {
  const startedAt = Date.now();
  const emit = (event: SittingEvent) => {
    try {
      send(event);
    } catch (err) {
      console.error("sitting: could not send event", err);
    }
  };

  const userMessage: MessageRow = {
    role: speaker === record.subject_name ? "subject" : "helper",
    content: text,
    blocks: [{ type: "text", text: `${speaker}: ${text}` }],
  };

  const [history, filledBefore, known] = await Promise.all([
    sittingMessages(sitting.id).then((h) => [...h, userMessage]),
    filledFields(record.id),
    knownEntities(record.id),
  ]);

  const userTurns = history.filter((m) => m.role === "subject" || m.role === "helper").length;
  const lastTurn = userTurns >= MAX_USER_TURNS;
  const minutesLeft = minutesLeftOf(sitting);

  const coverage = coverageOf(sitting.covers, filledBefore);
  const messages = toApiMessages(record, sitting, history);
  messages.push({
    role: "system",
    content: stateBlock(coverage, remainingQuestions(sitting.covers, filledBefore), minutesLeft),
  });
  if (lastTurn) messages.push({ role: "system", content: LAST_TURN });
  else if (minutesLeft <= WRAP_UP_AT_MINUTES) messages.push({ role: "system", content: WRAP_UP });

  const state: TurnState = { record, sitting, known, touched: new Set(), emit };
  let finished: string | undefined;
  let userSaved = false;
  let shownText = false;

  try {
    for (let call = 0; call < MAX_CALLS_PER_TURN && finished === undefined; call++) {
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
        sitting.id,
      );

      if (message.stop_reason === "refusal") {
        emit({ type: "reset" });
        emit({
          type: "error",
          message:
            "I can't help with that part here. Could you put it another way, or tell me about something else?",
          kept: false,
        });
        return;
      }

      const toolUses = message.content.filter((b) => b.type === "tool_use");
      if (message.stop_reason === "max_tokens" && toolUses.length) {
        throw new Error("sitting: tool input cut off at max_tokens");
      }

      if (!userSaved) {
        await appendSittingMessage(record.id, sitting.id, userMessage);
        userSaved = true;
      }
      const replyText = message.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
      const messageId = await appendSittingMessage(record.id, sitting.id, {
        role: "agent",
        content: replyText,
        blocks: message.content as ContentBlockParam[],
      });
      messages.push({ role: "assistant", content: message.content as ContentBlockParam[] });

      if (!toolUses.length) break;

      const results: ToolResult[] = [];
      let anyFailed = false;
      for (const tool of toolUses) {
        const outcome = await runTool(state, tool.name, tool.input, messageId);
        if (outcome.finished !== undefined) finished = outcome.finished;
        if (outcome.failed) anyFailed = true;
        results.push(outcome.failed ? toolError(tool.id, outcome.result) : ok(tool.id, outcome.result));
      }

      await appendSittingMessage(record.id, sitting.id, { role: "tool", content: "", blocks: results });
      messages.push({ role: "user", content: results });

      if (state.touched.size) {
        const after = await filledFields(record.id);
        emit({ type: "progress", ...coverageOf(sitting.covers, after) });
      }

      // The reply comes before the tool call, so the turn is normally over
      // here. Go round again only if nothing has been said, or a call failed
      // and the model needs to see why.
      if (shownText && !anyFailed) break;
    }
  } catch (err) {
    await logFailure({
      context: "sitting:turn",
      error: err,
      recordId: record.id,
      userId: record.owner_user_id,
      model: MODEL,
      startedAt,
    });
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

  const asks = newlyCovered(state.touched, filledBefore);
  if (asks.length) await recordQuestionAsks(record.id, sitting.id, asks);

  if (finished !== undefined || lastTurn) {
    const summary = finished || "Ended without a summary.";
    await completeSitting(record.id, sitting.id, summary);
    emit({ type: "done", summary });
  } else {
    emit({ type: "end" });
  }
}
