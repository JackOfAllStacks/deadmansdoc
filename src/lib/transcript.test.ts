import { describe, expect, it } from "vitest";
import { toChatHistory } from "@/lib/transcript";
import type { MessageRow } from "@/lib/records";

const person = (name: string, text: string, role: "subject" | "helper" = "helper"): MessageRow => ({
  role,
  content: text,
  blocks: [{ type: "text", text: `${name}: ${text}` }],
});

describe("toChatHistory", () => {
  it("recovers who said what", () => {
    expect(toChatHistory([person("Jack", "Robyn would organise people.")])).toEqual([
      { from: "person", name: "Jack", text: "Robyn would organise people." },
    ]);
  });

  it("doesn't mistake a colon in the message for a speaker", () => {
    const m = person("John", "Well: here's the thing, I never wrote it down.");
    expect(toChatHistory([m])).toEqual([
      { from: "person", name: "John", text: "Well: here's the thing, I never wrote it down." },
    ]);
  });

  it("copes with a block that isn't labelled at all", () => {
    const m: MessageRow = { role: "helper", content: "no prefix", blocks: [{ type: "text", text: "no prefix" }] };
    expect(toChatHistory([m])).toEqual([{ from: "person", name: "", text: "no prefix" }]);
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
      person("Jack", "first"),
      { role: "agent", content: "second", blocks: [{ type: "text", text: "second" }] },
      person("John", "third", "subject"),
    ];
    expect(toChatHistory(rows).map((m) => ("text" in m ? m.text : ""))).toEqual(["first", "second", "third"]);
  });
});
