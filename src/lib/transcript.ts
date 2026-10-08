import type { MessageRow } from "@/lib/records";

export type ChatMessage = { from: "agent"; text: string } | { from: "person"; text: string; id?: string };

// Stored messages back into something to show. A person's `content` is what
// they typed. Messages from before the speaker control was removed also carry
// a name prefix in the block sent to the model; it isn't shown.
export function toChatHistory(messages: MessageRow[]): ChatMessage[] {
  const history: ChatMessage[] = [];
  for (const m of messages) {
    if (m.role === "agent") {
      if (m.content.trim()) history.push({ from: "agent", text: m.content });
    } else if (m.role === "subject" || m.role === "helper") {
      history.push({ from: "person", text: m.content, id: m.id });
    }
  }
  return history;
}
