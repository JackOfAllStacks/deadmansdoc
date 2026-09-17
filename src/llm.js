// Thin adapter over an OpenAI-compatible chat completions API (tool calling
// included). Defaults to Groq serving an open-weight model for prototyping;
// swap providers by changing LLM_BASE_URL / LLM_API_KEY / LLM_MODEL only --
// nothing else in this file is provider-specific. This also covers a local
// Ollama install (LLM_BASE_URL=http://localhost:11434/v1, no key needed) --
// see README for the local-testing setup, including why that only works
// when running the app locally (`npm run dev`), not against the deployed
// site, which can't reach your machine's localhost.
const { TOOLS, executeToolCall } = require("./tools");

const MAX_TOOL_ROUNDS = 6;

function getConfig() {
  const baseUrl = process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";
  const apiKey = process.env.LLM_API_KEY || null;
  const model = process.env.LLM_MODEL || "openai/gpt-oss-120b";
  return { baseUrl, apiKey, model };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Small providers on free tiers (e.g. Groq's default per-minute token cap)
// return 429s under completely normal use, not just abuse -- worth one
// short retry so it doesn't surface to the user as a broken app.
async function callChatCompletions(messages, attempt = 0) {
  const { baseUrl, apiKey, model } = getConfig();
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429 && attempt < 1) {
      let waitMs = 3000;
      try {
        const parsed = JSON.parse(text);
        const match = /try again in ([\d.]+)s/i.exec(parsed.error && parsed.error.message);
        if (match) waitMs = Math.min(Math.ceil(parseFloat(match[1]) * 1000) + 250, 15000);
      } catch {
        /* fall back to default wait */
      }
      await sleep(waitMs);
      return callChatCompletions(messages, attempt + 1);
    }
    throw new Error(`LLM request failed (${res.status}): ${text}`);
  }
  return res.json();
}

/**
 * Runs one user turn to completion, including any tool-call rounds, against
 * the given recordId. Returns the final assistant reply plus a log of every
 * tool call made, so the caller can persist them.
 */
async function runInterviewTurn({ recordId, systemPrompt, history, userMessage }) {
  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage },
  ];

  const toolLog = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await callChatCompletions(messages);
    const choice = completion.choices && completion.choices[0];
    if (!choice) throw new Error("LLM returned no choices");
    const message = choice.message;

    const toolCalls = message.tool_calls || [];
    if (!toolCalls.length) {
      return { reply: message.content || "", toolLog };
    }

    messages.push({
      role: "assistant",
      content: message.content || null,
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      let args = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        args = {};
      }
      let result;
      try {
        result = await executeToolCall(recordId, call.function.name, args);
      } catch (err) {
        result = { ok: false, error: String(err.message || err) };
      }
      toolLog.push({ name: call.function.name, args, result });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    reply:
      "I've saved what we've covered so far -- let's pick this back up in a moment, I got a bit tangled there.",
    toolLog,
  };
}

module.exports = { runInterviewTurn };
