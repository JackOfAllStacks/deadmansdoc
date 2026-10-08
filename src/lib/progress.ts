import { artifact, milestoneSet, sectionFields } from "@/lib/content";
import type { CapturedItem, FilledField } from "@/lib/sitting/capture";

/*
 * How far through this is, said in terms somebody would care about.
 *
 * The discovery brief asked for a large, intimidating task made to feel
 * finite. What existed was a bar and a count of sittings, and a count of
 * sittings measures a schedule rather than an achievement: a sitting can
 * finish having recorded very little. What does the job is specificity --
 * telling somebody exactly what they have got, in terms of what the people
 * they leave behind would now be able to do.
 *
 * The distinction everything here turns on:
 *
 *   settled  -- every field holds an answer OR a recorded gap. Nothing left
 *               to cover. "There is nothing more to ask you about this."
 *   complete -- every field holds an answer. The stronger claim, and the only
 *               one that licenses saying the family would know something.
 *
 * A gap is knowledge and it counts: "nobody knows where that is" is exactly
 * what a family needs telling. But it is not an answer, and a product that
 * conflated the two would tell somebody their family is covered while the
 * record says the opposite.
 */

export interface SectionProgress {
  id: string;
  number: number;
  title: string;
  total: number;
  answered: number;
  gaps: number;
  /** Nothing left to ask about: every field has an answer or a recorded gap. */
  settled: boolean;
  /** Every field has an answer. Only this licenses a claim about what a family would know. */
  complete: boolean;
}

export interface MilestoneState {
  id: string;
  /** The claim, with `{family}` already filled in. */
  says: string;
  met: boolean;
  /**
   * What it still wants, by field label. Empty once met. `gap` is a field
   * already asked about and recorded as unknown: covered, but not answered.
   */
  missing: { id: string; label: string; gap: boolean }[];
}

export interface RecordProgress {
  total: number;
  answered: number;
  gaps: number;
  outstanding: number;
  sections: SectionProgress[];
  milestones: MilestoneState[];
  met: MilestoneState[];
  /** The nearest claim that isn't true yet — the fewest answers away. */
  next: MilestoneState | null;
}

/** "Your" or "Margaret's" becomes "Your family" or "Margaret's family". */
function saying(says: string, whose: string): string {
  return says.replace(/\{family\}/g, `${whose} family`).replace(/\s+/g, " ").trim();
}

export function progressFor(filled: FilledField[], whose: string): RecordProgress {
  const status = new Map(filled.map((f) => [f.field_id, f.status]));
  const answeredId = (id: string) => status.get(id) === "answered";
  const gapId = (id: string) => status.get(id) === "unknown";

  const sections: SectionProgress[] = artifact.sections.map((section) => {
    const fields = sectionFields(section);
    const answered = fields.filter((f) => answeredId(f.id)).length;
    const gaps = fields.filter((f) => gapId(f.id)).length;
    return {
      id: section.id,
      number: section.number,
      title: section.title,
      total: fields.length,
      answered,
      gaps,
      settled: fields.length > 0 && answered + gaps === fields.length,
      complete: fields.length > 0 && answered === fields.length,
    };
  });

  const labels = new Map(artifact.sections.flatMap(sectionFields).map((f) => [f.id, f.label]));
  const milestones: MilestoneState[] = milestoneSet.milestones.map((m) => {
    const missing = m.needs
      .filter((id) => !answeredId(id))
      .map((id) => ({ id, label: labels.get(id) ?? id, gap: gapId(id) }));
    return { id: m.id, says: saying(m.says, whose), met: missing.length === 0, missing };
  });

  const met = milestones.filter((m) => m.met);
  // The nearest one, so what's offered next is the smallest real step rather
  // than whatever happens to be first in the file. Ties go to file order,
  // which runs roughly in the order the sittings do.
  const next = milestones
    .filter((m) => !m.met)
    .reduce<MilestoneState | null>(
      (best, m) => (best === null || m.missing.length < best.missing.length ? m : best),
      null,
    );

  const total = sections.reduce((n, s) => n + s.total, 0);
  const answered = sections.reduce((n, s) => n + s.answered, 0);
  const gaps = sections.reduce((n, s) => n + s.gaps, 0);

  return {
    total,
    answered,
    gaps,
    outstanding: Math.max(0, total - answered - gaps),
    sections,
    milestones,
    met,
    next,
  };
}

/*
 * What one sitting got.
 *
 * The end of a sitting is the one moment somebody has just done something
 * hard, and it used to pass with "that's this sitting done" and a button. This
 * is what to say instead, and all of it is counted from what was actually
 * stored -- never a round number, never a reward, and nothing claimed that
 * isn't in the record.
 */
export interface SittingHarvest {
  /** Fields given an answer, entries and figures included. */
  recorded: number;
  /** People named, which is the spine of the whole document. */
  people: number;
  /** Other entries: an account, a bill, a debt. */
  entries: number;
  /** "Nobody knows" -- recorded rather than left blank, so it counts. */
  gaps: number;
  /** Kept, but nothing in the template covered it. */
  notes: number;
}

/** Which fields hold people, so a person is counted as a person. */
const PEOPLE_FIELDS = new Set(
  artifact.sections
    .flatMap(sectionFields)
    .filter((f) => f.type === "entities" && f.entity === "person")
    .map((f) => f.id),
);

export function harvestOf(items: CapturedItem[]): SittingHarvest {
  const people = new Set<string>();
  const entries = new Set<string>();
  let recorded = 0;
  let gaps = 0;
  let notes = 0;

  for (const item of items) {
    if (item.kind === "gap") {
      gaps += 1;
      continue;
    }
    if (item.kind === "note") {
      notes += 1;
      continue;
    }
    recorded += 1;
    // One person mentioned across five turns is one person. The same row can
    // arrive again as an amount against the entry it already created, so both
    // are counted by identity rather than by how many rows there are.
    if (item.entityId) {
      if (item.fieldId && PEOPLE_FIELDS.has(item.fieldId)) people.add(item.entityId);
      else entries.add(item.entityId);
    }
  }

  return { recorded, people: people.size, entries: entries.size, gaps, notes };
}
