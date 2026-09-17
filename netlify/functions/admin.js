// Admin/testing endpoint: lists every record, and allows deleting one.
// Deliberately not reachable with just a resume code (which only ever
// unlocks one record) -- gated behind a separate ADMIN_KEY env var instead.
// This is still just a shared secret, not real auth -- see SECURITY_NOTES.md.
const db = require("../../src/db");

function json(status, body) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function checkAdminKey(event) {
  const required = process.env.ADMIN_KEY;
  if (!required) {
    return { ok: false, status: 500, error: "ADMIN_KEY is not configured on the server." };
  }
  const headers = event.headers || {};
  const provided = headers["x-admin-key"] || headers["X-Admin-Key"];
  if (provided !== required) {
    return { ok: false, status: 401, error: "Invalid admin key." };
  }
  return { ok: true };
}

exports.handler = async (event) => {
  const auth = checkAdminKey(event);
  if (!auth.ok) return json(auth.status, { error: auth.error });

  try {
    if (event.httpMethod === "GET") {
      const [records, errors] = await Promise.all([
        db.listRecordsWithCounts(),
        db.listRecentErrors(),
      ]);
      return json(200, { records, errors });
    }

    if (event.httpMethod === "POST") {
      let payload;
      try {
        payload = JSON.parse(event.body || "{}");
      } catch {
        return json(400, { error: "Invalid JSON" });
      }
      if (payload.action === "delete" && payload.recordId) {
        await db.deleteRecord(payload.recordId);
        return json(200, { ok: true });
      }
      return json(400, { error: "Unknown action" });
    }

    return json(405, { error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return json(500, { error: "Something went wrong." });
  }
};
