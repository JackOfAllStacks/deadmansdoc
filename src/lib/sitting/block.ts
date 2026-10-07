import type { DocumentEntry } from "@/lib/sitting/document";

// One field's body, as the text that appears in the document and as the text
// someone edits -- the same string both ways, so nothing is reformatted under
// the cursor and nothing is lost on the way back.
//
// Deliberately pure and free of any content.ts import, so the browser can
// render a body with exactly the function the server parses it with.

export interface BlockShape {
  type: "text" | "list" | "ordered" | "people" | "entities";
  attributeKeys: string[];
  sealed: boolean;
}

/** Stands in for a figure that prints in the envelope, never in the document. */
export const SEALED_MARKER = "(sealed figure)";
const ACTION_KEY = "what to do";

const pretty = (key: string) => key.replace(/_/g, " ");
const normalise = (key: string) => key.trim().toLowerCase().replace(/\s+/g, "_");

function entityLine(shape: BlockShape, entry: DocumentEntry): string {
  const parts: string[] = [];
  if (shape.sealed) {
    parts.push(SEALED_MARKER);
  } else {
    for (const key of shape.attributeKeys) {
      if (key === "name") continue;
      const value = entry.attributes?.[key];
      if (value) parts.push(`${pretty(key)}: ${value}`);
    }
  }
  if (entry.detail) parts.push(`${ACTION_KEY}: ${entry.detail}`);
  return parts.length ? `${entry.label} — ${parts.join("; ")}` : entry.label;
}

export function renderBlock(shape: BlockShape, entries: DocumentEntry[]): string {
  if (shape.type === "entities") {
    return entries
      .filter((e) => e.entityId)
      .map((e) => entityLine(shape, e))
      .join("\n");
  }
  const entry = entries.find((e) => e.kind !== "gap");
  if (!entry) return "";
  const lines = entry.text ? [entry.text] : [];
  if (entry.detail) lines.push(`${ACTION_KEY}: ${entry.detail}`);
  return lines.join("\n");
}

export interface ParsedEntity {
  label: string;
  attributes: { key: string; value: string }[];
  familyAction: string | null;
  /** Only set for a sealed field, and only when it isn't still the marker. */
  amount: string | null;
}

export type ParsedBlock =
  | { kind: "clear" }
  | { kind: "value"; text: string | null; items: string[] | null; people: string[] | null; familyAction: string | null }
  | { kind: "entities"; entries: ParsedEntity[] };

// Bullets and numbering are how a list reads, so they're accepted back even
// though nothing writes them: someone tidying a list by hand will add them.
const strip = (line: string) => line.replace(/^\s*(?:[-*•]\s+|\d+[.)]\s+)/, "").trim();

function takeAction(lines: string[]): { lines: string[]; familyAction: string | null } {
  const at = lines.findIndex((l) => normalise(l.split(":")[0] ?? "") === normalise(ACTION_KEY));
  if (at === -1) return { lines, familyAction: null };
  const value = lines[at].slice(lines[at].indexOf(":") + 1).trim();
  return { lines: lines.filter((_, i) => i !== at), familyAction: value || null };
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A semicolon separates one detail from the next -- but it is also ordinary
// punctuation inside a sentence ("ring Dan; he'll need time to travel"). So a
// semicolon only ends a detail when a key it could belong to follows it.
function splitDetails(shape: BlockShape, rest: string): string[] {
  const keys = [...shape.attributeKeys.filter((k) => k !== "name").map(pretty), ACTION_KEY];
  if (!keys.length) return rest ? [rest] : [];
  const boundary = new RegExp(`;\\s*(?=(?:${keys.map(escape).join("|")})\\s*:)`, "i");
  return rest.split(boundary);
}

function parseEntityLine(shape: BlockShape, line: string): ParsedEntity | null {
  const split = line.indexOf("—") === -1 ? line.indexOf(" - ") : line.indexOf("—");
  const label = (split === -1 ? line : line.slice(0, split)).trim();
  if (!label) return null;

  const rest = split === -1 ? "" : line.slice(split + (line.indexOf("—") === -1 ? 3 : 1)).trim();
  const attributes: { key: string; value: string }[] = [];
  let familyAction: string | null = null;
  let amount: string | null = null;
  // Anything the writer didn't key lands wherever the shape keeps loose
  // remarks, rather than being dropped for not having a colon in it.
  const fallbackKey = shape.attributeKeys.includes("notes")
    ? "notes"
    : shape.attributeKeys.find((k) => k !== "name");

  for (const part of splitDetails(shape, rest)) {
    const piece = part.trim();
    if (!piece) continue;
    const colon = piece.indexOf(":");
    const key = colon === -1 ? "" : normalise(piece.slice(0, colon));
    const value = colon === -1 ? piece : piece.slice(colon + 1).trim();
    if (!value || value === SEALED_MARKER) continue;

    if (key === normalise(ACTION_KEY)) familyAction = value;
    else if (shape.sealed) amount = value;
    else if (key && shape.attributeKeys.includes(key)) attributes.push({ key, value });
    else if (fallbackKey) attributes.push({ key: fallbackKey, value: key ? piece : value });
  }

  return { label, attributes, familyAction, amount };
}

export function parseBlock(shape: BlockShape, body: string): ParsedBlock {
  const lines = body
    .split("\n")
    .map(strip)
    .filter(Boolean);
  if (!lines.length) return { kind: "clear" };

  if (shape.type === "entities") {
    const entries = lines.map((line) => parseEntityLine(shape, line)).filter((e): e is ParsedEntity => e !== null);
    return entries.length ? { kind: "entities", entries } : { kind: "clear" };
  }

  const { lines: rest, familyAction } = takeAction(lines);
  if (!rest.length) return { kind: "clear" };

  if (shape.type === "text") return { kind: "value", text: rest.join("\n"), items: null, people: null, familyAction };
  if (shape.type === "people") {
    const people = rest.flatMap((l) => l.split(",")).map((s) => s.trim()).filter(Boolean);
    return { kind: "value", text: null, items: null, people, familyAction };
  }
  return { kind: "value", text: null, items: rest, people: null, familyAction };
}
