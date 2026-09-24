import type { MessageRow } from "@/lib/records";

export type ChatMessage = { from: "agent"; text: string } | { from: "person"; name: string; text: string };

// Stored messages back into something to show. A person's message is kept
// twice: `content` is what they typed, and the block sent to the model is
// prefixed with their name, because two people share one keyboard. The name
// is recovered from the block rather than by splitting on a colon, which
// would turn "Well: here's the thing" into a speaker called "Well".
export function toChatHistory(messages: MessageRow[]): ChatMessage[] {
  const history: ChatMessage[] = [];
  for (const m of messages) {
    if (m.role === "agent") {
      if (m.content.trim()) history.push({ from: "agent", text: m.content });
    } else if (m.role === "subject" || m.role === "helper") {
      const first = m.blocks[0];
      const labelled = first && first.type === "text" ? first.text : "";
      const name = labelled.endsWith(`: ${m.content}`) ? labelled.slice(0, -(m.content.length + 2)) : "";
      history.push({ from: "person", name, text: m.content });
    }
  }
  return history;
}
