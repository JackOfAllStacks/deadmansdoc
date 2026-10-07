/*
 * The two inline marks the documents use, read once.
 *
 * doc.ts writes **strong** and _quiet_ and nothing else. Three things now have
 * to understand them -- the page, the Markdown, and the Word file -- and the
 * point of parsing them here is that they cannot come to different conclusions
 * about what a line says.
 */

export type Mark = "strong" | "quiet" | null;

export interface Run {
  text: string;
  mark: Mark;
}

const INLINE = /(\*\*[^*]+\*\*|_[^_]+_)/g;

export function parseInline(text: string): Run[] {
  return text
    .split(INLINE)
    .filter((part) => part !== "")
    .map((part) => {
      if (part.startsWith("**") && part.endsWith("**")) return { text: part.slice(2, -2), mark: "strong" as const };
      if (part.startsWith("_") && part.endsWith("_")) return { text: part.slice(1, -1), mark: "quiet" as const };
      return { text: part, mark: null };
    });
}
