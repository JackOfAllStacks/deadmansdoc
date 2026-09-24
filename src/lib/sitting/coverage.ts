import { expandCovers, fieldsById, questionBank, type Field, type Level, type Question } from "@/lib/content";
import type { FilledField } from "@/lib/sitting/capture";

// The question bank is a checklist, not a script. Each turn the server works
// out what still matters for this sitting and hands the model a few of them;
// it writes its own questions from those. Nothing here asks the model to keep
// track of what it has already covered.

const LEVEL_SCORE: Record<Level, number> = { high: 0, medium: 1, low: 2 };

export function sittingFields(covers: string[]): Field[] {
  return expandCovers(covers)
    .map((id) => fieldsById.get(id))
    .filter((f): f is Field => Boolean(f));
}

/** A field counts as settled once it holds an answer or a recorded gap. */
function settledIds(filled: FilledField[]): Set<string> {
  return new Set(filled.filter((f) => f.status !== "skipped").map((f) => f.field_id));
}

export interface Coverage {
  total: number;
  answered: number;
  gaps: number;
  outstanding: Field[];
}

export function coverageOf(covers: string[], filled: FilledField[]): Coverage {
  const fields = sittingFields(covers);
  const byId = new Map(filled.map((f) => [f.field_id, f.status]));
  const mine = fields.filter((f) => byId.has(f.id));
  return {
    total: fields.length,
    answered: mine.filter((f) => byId.get(f.id) === "answered").length,
    gaps: mine.filter((f) => byId.get(f.id) === "unknown").length,
    outstanding: fields.filter((f) => !settledIds(filled).has(f.id)),
  };
}

// Highest priority first, then the ranking the bank was narrowed by:
// irreplaceability (nobody else can answer it), decay (it gets worse with
// time), generativity (it leads somewhere).
function ordering(a: Question, b: Question): number {
  if (a.priority !== b.priority) return a.priority - b.priority;
  const keys = ["irreplaceability", "decay", "generativity"] as const;
  for (const key of keys) {
    const diff = LEVEL_SCORE[a.rank[key]] - LEVEL_SCORE[b.rank[key]];
    if (diff !== 0) return diff;
  }
  return a.id.localeCompare(b.id);
}

/**
 * Questions worth asking next: those that fill something this sitting covers
 * and hasn't settled yet. A question filling several fields drops out as soon
 * as any of them is settled, because asking it again would cover ground the
 * person has already been over.
 */
export function remainingQuestions(covers: string[], filled: FilledField[], limit = 6): Question[] {
  const mine = new Set(sittingFields(covers).map((f) => f.id));
  const settled = settledIds(filled);

  return questionBank.questions
    .filter((q) => {
      const relevant = q.fills.filter((id) => mine.has(id));
      return relevant.length > 0 && !relevant.some((id) => settled.has(id));
    })
    .sort(ordering)
    .slice(0, limit);
}
