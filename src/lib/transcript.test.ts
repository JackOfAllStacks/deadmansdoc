import { describe, expect, it } from "vitest";
import { toChatHistory } from "@/lib/transcript";
import type { MessageRow } from "@/lib/records";

const person = (text: string): MessageRow => ({ role: "subject", content: text, blocks: [{ type: "text", text }] });

describe("toChatHistory", () => {
  it("shows what the person typed", () => {
    expect(toChatHistory([person("Robyn would organise people.")])).toEqual([
      { from: "person", text: "Robyn would organise people." },
    ]);
  });

  it("drops the name from messages stored when there was a speaker control", () => {
    const m: MessageRow = {
      role: "helper",
      content: "Well: here's the thing, I never wrote it down.",
      blocks: [{ type: "text", text: "Jack: Well: here's the thing, I never wrote it down." }],
    };
    expect(toChatHistory([m])).toEqual([{ from: "person", text: "Well: here's the thing, I never wrote it down." }]);
  });

  it("leaves out tool messages and empty agent turns", () => {
    const rows: MessageRow[] = [
      { role: "agent", content: "", blocks: [] },
      { role: "tool", content: "", blocks: [] },
      { role: "agent", content: "Thank you.", blocks: [{ type: "text", text: "Thank you." }] },
    ];
    expect(toChatHistory(rows)).toEqual([{ from: "agent", text: "Thank you." }]);
  });

  it("keeps the order it was given", () => {
    const rows: MessageRow[] = [
      person("first"),
      { role: "agent", content: "second", blocks: [{ type: "text", text: "second" }] },
      person("third"),
    ];
    expect(toChatHistory(rows).map((m) => m.text)).toEqual(["first", "second", "third"]);
  });
});
