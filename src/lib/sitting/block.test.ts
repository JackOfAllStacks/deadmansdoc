import { describe, expect, it } from "vitest";
import { parseBlock, renderBlock, SEALED_MARKER, type BlockShape } from "@/lib/sitting/block";
import type { DocumentEntry } from "@/lib/sitting/document";

const person: BlockShape = {
  type: "entities",
  attributeKeys: ["name", "relationship", "role", "phone", "email", "notes"],
  sealed: false,
};
const prose: BlockShape = { type: "text", attributeKeys: [], sealed: false };
const list: BlockShape = { type: "list", attributeKeys: [], sealed: false };
const ordered: BlockShape = { type: "ordered", attributeKeys: [], sealed: false };
const people: BlockShape = { type: "people", attributeKeys: [], sealed: false };
const balances: BlockShape = { type: "entities", attributeKeys: ["institution", "kind"], sealed: true };

const entity = (label: string, attributes: Record<string, string>, detail: string | null = null): DocumentEntry => ({
  kind: "entity",
  entityId: `id-${label}`,
  label,
  text: null,
  detail,
  attributes,
});

const value = (text: string, detail: string | null = null): DocumentEntry => ({
  kind: "field",
  entityId: null,
  label: "",
  text,
  detail,
  attributes: null,
});

describe("what the document shows", () => {
  it("writes a person as one line, keyed by what is known about them", () => {
    const body = renderBlock(person, [entity("Ellie", { relationship: "child", phone: "0412 555 010" })]);
    expect(body).toBe("Ellie — relationship: child; phone: 0412 555 010");
  });

  it("puts what the family has to do on the same line, so editing it is editing the line", () => {
    const body = renderBlock(person, [entity("Ellie", { relationship: "child" }, "Call her first.")]);
    expect(body).toBe("Ellie — relationship: child; what to do: Call her first.");
  });

  it("names a person with nothing else known about them, without a trailing dash", () => {
    expect(renderBlock(person, [entity("Ken", {})])).toBe("Ken");
  });

  it("never shows a sealed figure, only that there is one", () => {
    const body = renderBlock(balances, [
      { kind: "amount", entityId: "e1", label: "NAB everyday", text: null, detail: null, attributes: null },
    ]);
    expect(body).toBe(`NAB everyday — ${SEALED_MARKER}`);
  });

  it("gives a list a line each", () => {
    expect(renderBlock(list, [value("Ring the funeral home\nCancel the paper")])).toBe(
      "Ring the funeral home\nCancel the paper",
    );
  });

  it("shows nothing for a field holding only a gap, so the placeholder speaks instead", () => {
    const gap: DocumentEntry = { kind: "gap", entityId: null, label: "", text: null, detail: "Marg", attributes: null };
    expect(renderBlock(prose, [gap])).toBe("");
  });
});

describe("reading the document back", () => {
  it("round-trips a person unchanged", () => {
    const entries = [entity("Ellie", { relationship: "child", role: "First call" }, "Ring her first.")];
    const body = renderBlock(person, entries);
    const parsed = parseBlock(person, body);
    expect(parsed).toEqual({
      kind: "entities",
      entries: [
        {
          label: "Ellie",
          attributes: [
            { key: "relationship", value: "child" },
            { key: "role", value: "First call" },
          ],
          familyAction: "Ring her first.",
          amount: null,
        },
      ],
    });
  });

  // The bug this file exists for: a semicolon is a separator between details
  // and ordinary punctuation inside one, and only the following key tells
  // them apart.
  it("keeps a semicolon that is punctuation rather than a separator", () => {
    const parsed = parseBlock(person, "Dan — role: Second call; what to do: Ring Dan after Ellie; he needs to fly in.");
    expect(parsed).toEqual({
      kind: "entities",
      entries: [
        {
          label: "Dan",
          attributes: [{ key: "role", value: "Second call" }],
          familyAction: "Ring Dan after Ellie; he needs to fly in.",
          amount: null,
        },
      ],
    });
  });

  it("survives a round trip even when a value is full of punctuation", () => {
    const messy = entity("Judith", { notes: "Tell her; don't involve her: it would cause a row." });
    const parsed = parseBlock(person, renderBlock(person, [messy]));
    expect(parsed).toEqual({
      kind: "entities",
      entries: [
        {
          label: "Judith",
          attributes: [{ key: "notes", value: "Tell her; don't involve her: it would cause a row." }],
          familyAction: null,
          amount: null,
        },
      ],
    });
  });

  it("keeps an unkeyed remark rather than dropping it", () => {
    const parsed = parseBlock(person, "Bob — has the spare key");
    expect(parsed).toMatchObject({
      entries: [{ label: "Bob", attributes: [{ key: "notes", value: "has the spare key" }] }],
    });
  });

  it("takes a line back after someone tidied it into a bullet", () => {
    expect(parseBlock(list, "- Ring the funeral home\n- Cancel the paper")).toMatchObject({
      items: ["Ring the funeral home", "Cancel the paper"],
    });
  });

  it("takes a sequence back after someone numbered it", () => {
    expect(parseBlock(ordered, "1. Register the death\n2. Ring the bank")).toMatchObject({
      items: ["Register the death", "Ring the bank"],
    });
  });

  it("splits names on commas as well as lines", () => {
    expect(parseBlock(people, "Ellie, Dan\nMarg")).toMatchObject({ people: ["Ellie", "Dan", "Marg"] });
  });

  it("reads an emptied body as a deletion rather than an empty answer", () => {
    expect(parseBlock(prose, "   \n  ")).toEqual({ kind: "clear" });
    expect(parseBlock(person, "")).toEqual({ kind: "clear" });
  });

  it("leaves a sealed figure alone when the marker wasn't touched", () => {
    const parsed = parseBlock(balances, `NAB everyday — ${SEALED_MARKER}`);
    expect(parsed).toMatchObject({ entries: [{ label: "NAB everyday", amount: null }] });
  });

  it("takes a figure typed over the marker", () => {
    const parsed = parseBlock(balances, "NAB everyday — about $12,400");
    expect(parsed).toMatchObject({ entries: [{ label: "NAB everyday", amount: "about $12,400" }] });
  });

  it("pulls what the family has to do off a prose answer", () => {
    expect(parseBlock(prose, "Everything is in the green folder.\nwhat to do: Look there first.")).toEqual({
      kind: "value",
      text: "Everything is in the green folder.",
      items: null,
      people: null,
      familyAction: "Look there first.",
    });
  });
});
