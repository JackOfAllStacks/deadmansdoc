import { z } from "zod";
import { logFailure } from "@/lib/errors";
import { getRecordForUser, speakersFor } from "@/lib/records";
import { getSession } from "@/lib/session";
import { MAX_MESSAGE_LENGTH, runSittingTurn, type SittingEvent } from "@/lib/sitting/agent";
import { acquireSittingLock, openSitting, releaseSittingLock } from "@/lib/sitting/store";

const bodySchema = z.object({
  text: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  speaker: z.string(),
});

const fail = (status: number, message: string) => Response.json({ error: message }, { status });

// Replies stream back as newline-delimited JSON SittingEvents. The sitting is
// whichever one is open for this account's record — never an id from the
// browser, so one account can't reach another's.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail(401, "Please sign in again.");

  const record = await getRecordForUser(session.user.id);
  if (!record) return fail(404, "Start a record first.");

  const sitting = await openSitting(record.id);
  if (!sitting) return fail(409, "No sitting is open. Start one from your plan.");

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail(400, `Messages need to be between 1 and ${MAX_MESSAGE_LENGTH} characters.`);
  if (!speakersFor(record).includes(body.data.speaker)) return fail(400, "Choose who is typing.");

  if (!(await acquireSittingLock(sitting.id))) {
    return fail(409, "Still working on the last reply. Give it a moment.");
  }

  const encoder = new TextEncoder();
  let open = true;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // If the person closes the tab mid-reply, finish the turn anyway so
      // what they said is saved and the lock is released.
      const emit = (event: SittingEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false;
        }
      };
      try {
        await runSittingTurn(record, sitting, body.data.speaker, body.data.text, emit);
      } catch (err) {
        await logFailure({
          context: "sitting:request",
          error: err,
          recordId: record.id,
          userId: session.user.id,
        });
        emit({ type: "error", message: "Something went wrong on our side. Please send that again.", kept: false });
      } finally {
        await releaseSittingLock(sitting.id);
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
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
