// Creates a new record (start of an interview) or resumes an existing one by
// resume code. No auth in this prototype -- the resume code is a convenience,
// not a security boundary. See SECURITY_NOTES.md.
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

  const { action } = payload;

  try {
    if (action === "create") {
      const { mode, subjectName, initiatorRelationship, whoIsPresent, consentGiven } = payload;
      if (mode !== "self" && mode !== "parent") {
        return json(400, { error: "mode must be 'self' or 'parent'" });
      }
      if (!consentGiven) {
        return json(400, { error: "Consent is required to start a session" });
      }

      const record = await db.createRecord({ mode, subjectName, initiatorRelationship });
      const session = await db.createSession({
        recordId: record.id,
        whoIsPresent,
        consentGiven,
      });

      return json(200, {
        recordId: record.id,
        resumeCode: record.resume_code,
        sessionId: session.id,
        mode: record.mode,
        subjectName: record.subject_name,
        history: [],
      });
    }

    if (action === "resume") {
      const { resumeCode, whoIsPresent, consentGiven } = payload;
      if (!resumeCode) return json(400, { error: "resumeCode is required" });

      const record = await db.getRecordByResumeCode(resumeCode.trim().toLowerCase());
      if (!record) return json(404, { error: "No record found for that code" });

      const session = await db.createSession({
        recordId: record.id,
        whoIsPresent,
        consentGiven: consentGiven !== false,
      });

      const priorMessages = await db.getMessagesForRecord(record.id);
      const history = priorMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));

      return json(200, {
        recordId: record.id,
        resumeCode: record.resume_code,
        sessionId: session.id,
        mode: record.mode,
        subjectName: record.subject_name,
        initiatorRelationship: record.initiator_relationship,
        history,
      });
    }

    return json(400, { error: "Unknown action" });
  } catch (err) {
    console.error(err);
    return json(500, { error: "Something went wrong. Please try again." });
  }
};
