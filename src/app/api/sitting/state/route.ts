import { getRecordForUser } from "@/lib/records";
import { getSession } from "@/lib/session";
import { isBusy, openSitting } from "@/lib/sitting/store";

// Whether a reply is still being written. A sitting carries on server-side
// when the browser goes away -- so that what was said is saved either way --
// which means a page opened mid-reply has to be able to ask.
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Please sign in again." }, { status: 401 });

  const record = await getRecordForUser(session.user.id);
  if (!record) return Response.json({ error: "No record." }, { status: 404 });

  const sitting = await openSitting(record.id);
  return Response.json(
    { open: Boolean(sitting), busy: sitting ? isBusy(sitting) : false },
    { headers: { "cache-control": "no-store" } },
  );
}
