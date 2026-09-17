import { db } from "@/lib/db";
import { artifact, questionBank } from "@/lib/content";

export async function GET() {
  const content = {
    artifactVersion: artifact.version,
    sectionsInScope: artifact.scope,
    questions: questionBank.questions.length,
  };

  try {
    await db()`select 1`;
    return Response.json({ ok: true, database: "reachable", content });
  } catch (err) {
    console.error("health check: database query failed", err);
    return Response.json({ ok: false, database: "unreachable", content }, { status: 503 });
  }
}
