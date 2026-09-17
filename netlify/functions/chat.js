// Handles one turn of the interview: takes the user's message, runs it
// through the LLM (with tool calling to persist structured data), stores the
// turn, and returns the assistant's reply.
const db = require("../../src/db");
const { buildSystemPrompt } = require("../../src/systemPrompt");
const { runInterviewTurn } = require("../../src/llm");

function json(status, body) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const { recordId, sessionId, message } = payload;
  if (!recordId || !sessionId || !message || !message.trim()) {
    return json(400, { error: "recordId, sessionId and message are required" });
  }

  try {
    const [record, session] = await Promise.all([
      db.getRecordById(recordId),
      db.getSession(sessionId),
    ]);
    if (!record) return json(404, { error: "Record not found" });
    if (!session || session.record_id !== recordId) {
      return json(404, { error: "Session not found" });
    }

    const priorMessages = await db.getMessagesForRecord(recordId);
    const history = priorMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    const systemPrompt = buildSystemPrompt({
      mode: record.mode,
      subjectName: record.subject_name,
      initiatorRelationship: record.initiator_relationship,
      whoIsPresent: session.who_is_present,
    });

    const { reply, toolLog } = await runInterviewTurn({
      recordId,
      systemPrompt,
      history,
      userMessage: message,
    });

    await db.addMessage({ sessionId, recordId, role: "user", content: message });
    for (const t of toolLog) {
      await db.addMessage({
        sessionId,
        recordId,
        role: "tool",
        toolName: t.name,
        content: JSON.stringify({ args: t.args, result: t.result }),
      });
    }
    await db.addMessage({ sessionId, recordId, role: "assistant", content: reply });
    await db.touchSession(sessionId);

    return json(200, { reply, saved: toolLog.map((t) => ({ tool: t.name, ok: t.result.ok })) });
  } catch (err) {
    console.error(err);
    return json(500, { error: "Something went wrong. Please try again." });
  }
};
