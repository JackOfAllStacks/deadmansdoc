import { collectRecord } from "@/lib/artifact/collect";
import { toDocx } from "@/lib/artifact/docx";
import { envelopeDoc, guideDoc } from "@/lib/artifact/render";
import { journeyFor } from "@/lib/journey";
import { getSession, isAdmin } from "@/lib/session";
import { todayInMelbourne } from "@/lib/today";

// The Guide and the envelope as Word files.
//
// Built here rather than in the browser because the document is already
// assembled on the server and nothing about it should be decided twice. A
// record id is only honoured for an admin; for everyone else this is their own
// record and nothing else, whatever the query string says.

const FILENAME = /[^a-z0-9]+/g;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Please sign in again.", { status: 401 });

  const url = new URL(request.url);
  const wantsEnvelope = url.searchParams.get("kind") === "envelope";
  const asked = url.searchParams.get("record");

  let recordId: string | undefined;
  if (asked) {
    if (!isAdmin(session.user)) return new Response("Not found.", { status: 404 });
    recordId = asked;
  } else {
    const journey = await journeyFor(session.user.id);
    recordId = journey.record?.id;
  }
  if (!recordId) return new Response("No record yet.", { status: 404 });

  const data = await collectRecord(recordId);
  if (!data) return new Response("No record yet.", { status: 404 });

  const meta = { version: "draft", preparedOn: todayInMelbourne() };
  const doc = wantsEnvelope ? envelopeDoc(data, meta) : guideDoc(data, meta);
  // An envelope only exists when something was sealed.
  if (!doc) return new Response("There is no envelope for this record.", { status: 404 });

  const buffer = await toDocx(doc);
  const name = `${wantsEnvelope ? "sealed-envelope" : "guide"}-${data.header.subject_name.toLowerCase().replace(FILENAME, "-")}.docx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
