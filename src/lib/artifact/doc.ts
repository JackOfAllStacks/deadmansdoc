/*
 * What the two documents are, before they are anything you can look at.
 *
 * The rules about what prints and what doesn't live in render.ts and are
 * written once. This is the shape they produce: sections, the parts under
 * them, and the entries under those. Markdown is one way of writing it out
 * (toMarkdown, below) and the page the person reads is another, so neither
 * can drift from the other or quietly disagree about what a record contains.
 *
 * Entry text carries the two inline marks the documents use -- **strong** and
 * _quiet_ -- and nothing else. That is a deliberate ceiling: a document about
 * someone's death has no business growing a formatting language.
 */

export type Shape = "bullets" | "steps" | "para";

export interface Entry {
  /** The lines of this entry, without any list marker. */
  lines: string[];
  shape: Shape;
  /** Quieter lines belonging to the whole entry — what to do, how sure they were. */
  asides: string[];
}

export interface DocPart {
  /** The field's own label. Absent where the entries speak for themselves. */
  heading?: string;
  entries: Entry[];
}

export interface DocSection {
  heading: string;
  /** Said instead of parts, or after them: why there is nothing to read here. */
  note?: string;
  parts: DocPart[];
}

export interface Doc {
  title: string;
  forWhom: string;
  prepared: string;
  version: string;
  framing: string;
  disclaimer: string;
  sections: DocSection[];
}

const marker = (shape: Shape, i: number) => (shape === "bullets" ? "- " : shape === "steps" ? `${i + 1}. ` : "");

function entryLines(entry: Entry): string[] {
  const out = entry.lines.map((line, i) => `${marker(entry.shape, i)}${line}`);
  for (const aside of entry.asides) out.push(`  _${aside}_`);
  return out;
}

/** The documents as they print and download: Markdown, exactly as before. */
export function toMarkdown(doc: Doc): string {
  const lines: string[] = [
    `# ${doc.title}`,
    "",
    `**For:** ${doc.forWhom}`,
    `**Prepared:** ${doc.prepared} · **Version:** ${doc.version}`,
    "",
    doc.framing,
    "",
    doc.disclaimer,
    "",
    "---",
    "",
  ];

  for (const section of doc.sections) {
    lines.push(`## ${section.heading}`, "");
    for (const part of section.parts) {
      if (part.heading) lines.push(`### ${part.heading}`, "");
      for (const entry of part.entries) lines.push(...entryLines(entry));
      lines.push("");
    }
    if (section.note) lines.push(section.note, "");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
