import { z } from "zod";
import { MAX_MESSAGE_LENGTH, runIntakeTurn, type IntakeEvent } from "@/lib/intake/agent";
import { acquireIntakeLock, getRecordForUser, releaseIntakeLock, speakersFor } from "@/lib/records";
import { getSession } from "@/lib/session";

const bodySchema = z.object({
  text: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  speaker: z.string(),
});

const fail = (status: number, message: string) => Response.json({ error: message }, { status });

// Replies stream back as newline-delimited JSON IntakeEvents.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail(401, "Please sign in again.");

  const record = await getRecordForUser(session.user.id);
  if (!record) return fail(404, "Start a record first.");
  if (record.intake_completed_at) return fail(409, "This conversation has already finished.");

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail(400, `Messages need to be between 1 and ${MAX_MESSAGE_LENGTH} characters.`);
  if (!speakersFor(record).includes(body.data.speaker)) return fail(400, "Choose who is typing.");

  if (!(await acquireIntakeLock(record.id))) {
    return fail(409, "Still working on the last reply. Give it a moment.");
  }

  const encoder = new TextEncoder();
  let open = true;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // If the person closes the tab mid-reply, finish the turn anyway so the
      // answer is saved and the lock is released; just stop writing to them.
      const emit = (event: IntakeEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false;
        }
      };
      try {
        await runIntakeTurn(record, body.data.speaker, body.data.text, emit);
      } catch (err) {
        console.error("intake: request failed", err);
        emit({ type: "error", message: "Something went wrong on our side. Please send that again.", kept: false });
      } finally {
        await releaseIntakeLock(record.id);
        if (open) {
          open = false;
          try {
            controller.close();
          } catch {
            // Already closed by the client going away.
          }
        }
      }
    },
    cancel() {
      open = false;
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
