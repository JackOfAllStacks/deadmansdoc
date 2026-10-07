import {
  expandCovers,
  fieldsById,
  questionBank,
  sessionTemplate,
  type Field,
  type Level,
  type Question,
} from "@/lib/content";
import type { SittingTopic } from "@/lib/plan/template";
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

/**
 * What a person is shown while the conversation runs: the sitting's areas, in
 * plain words, each reporting how much of itself has been settled.
 *
 * This is the scaffolding the interview otherwise lacks. An empty text box
 * asks someone to work out for themselves what is worth saying about their own
 * death; these say what ground is being covered and how far through it we are.
 */
export interface TopicProgress {
  label: string;
  blurb: string;
  total: number;
  answered: number;
  gaps: number;
  done: boolean;
  started: boolean;
}

export function topicsFor(sittingKey: string): SittingTopic[] {
  return sessionTemplate.sittings.find((s) => s.key === sittingKey)?.topics ?? [];
}

export function topicProgress(topics: SittingTopic[], filled: FilledField[]): TopicProgress[] {
  const byId = new Map(filled.map((f) => [f.field_id, f.status]));
  return topics.map((topic) => {
    const answered = topic.covers.filter((id) => byId.get(id) === "answered").length;
    const gaps = topic.covers.filter((id) => byId.get(id) === "unknown").length;
    return {
      label: topic.label,
      blurb: topic.blurb,
      total: topic.covers.length,
      answered,
      gaps,
      // A topic is finished once every field under it is settled — which
      // includes "nobody knows", because that is an answer the family needs.
      done: answered + gaps === topic.covers.length,
      started: answered + gaps > 0,
    };
  });
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
