// Read-only lookup of everything saved for a record, keyed by resume code.
// Does not create a session or touch the conversation -- purely for
// inspecting what the interview has collected so far.
const db = require("../../src/db");

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

  const { resumeCode } = payload;
  if (!resumeCode) return json(400, { error: "resumeCode is required" });

  try {
    const record = await db.getRecordByResumeCode(resumeCode.trim().toLowerCase());
    if (!record) return json(404, { error: "No record found for that code" });

    const { people, facts, gaps } = await db.getRecordSnapshot(record.id);
    const rawMessages = await db.getMessagesForRecord(record.id, 1000);
    const messages = rawMessages.map((m) => ({
      role: m.role,
      content: m.content,
      toolName: m.tool_name,
      createdAt: m.created_at,
    }));

    return json(200, {
      record: {
        mode: record.mode,
        subjectName: record.subject_name,
        initiatorRelationship: record.initiator_relationship,
        status: record.status,
        resumeCode: record.resume_code,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
      },
      people,
      facts,
      gaps,
      messages,
    });
  } catch (err) {
    console.error(err);
    return json(500, { error: "Something went wrong. Please try again." });
  }
};
