import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

// Coarse kinds, so the admin list tells you what sort of problem this was
// without re-reading every message. Borrowed from the shape Santi's fork
// settled on after running a lot of real turns.
export type ErrorType =
  | "rate_limit"
  | "overloaded"
  | "auth"
  | "bad_request"
  | "not_found"
  | "server_error"
  | "network_error"
  | "app_error";

export interface Failure {
  context: string;
  error: unknown;
  recordId?: string | null;
  userId?: string | null;
  model?: string | null;
  startedAt?: number;
}

// A failure with no status never reached the provider at all — DNS, a refused
// connection, an aborted request. That's a genuinely different problem from
// "the provider answered and said no", and worth telling apart at a glance.
export function classifyFailure(error: unknown): { type: ErrorType; status: number | null } {
  if (error instanceof Anthropic.APIError) {
    const status = typeof error.status === "number" ? error.status : null;
    if (status === null) return { type: "network_error", status };
    if (status === 429) return { type: "rate_limit", status };
    if (status === 529) return { type: "overloaded", status };
    if (status === 401 || status === 403) return { type: "auth", status };
    if (status === 404) return { type: "not_found", status };
    if (status >= 500) return { type: "server_error", status };
    if (status >= 400) return { type: "bad_request", status };
    return { type: "app_error", status };
  }
  return { type: "app_error", status: null };
}

export function failureMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

// Never throws. Logging a failure must not turn a handled error into an
// unhandled one, so a database problem here is reported to stdout and dropped.
export async function logFailure({ context, error, recordId, userId, model, startedAt }: Failure): Promise<void> {
  const { type, status } = classifyFailure(error);
  const message = failureMessage(error).slice(0, 4000);
  const durationMs = startedAt === undefined ? null : Date.now() - startedAt;

  console.error(JSON.stringify({ event: "failure", context, error_type: type, status, model, message }));

  try {
    await db()`
      insert into error_logs (record_id, user_id, context, error_type, status_code, model, duration_ms, message)
      values (${recordId ?? null}, ${userId ?? null}, ${context}, ${type}, ${status}, ${model ?? null}, ${durationMs}, ${message})
    `;
  } catch (err) {
    console.error("could not write error_logs row", err);
  }
}
