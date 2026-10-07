import { artifact, expandCovers, fieldsById, sectionFields, sessionTemplate, type FieldType } from "@/lib/content";
import { db } from "@/lib/db";

/*
 * What's still to find out.
 *
 * Every "I don't know" is already a first-class thing in the record: a
 * field_values row with status 'unknown', whoever might know, and how much it
 * matters. Until now three things read that and none of them was the person
 * who made the record -- the Guide prints one line, home shows a count, and
 * the admin view lists them. So the thing this product is proudest of finding
 * was the thing it did least with.
 *
 * The grouping is the whole point: two gaps routed to Peter are one errand,
 * not two. A page that lists them field by field is a list of holes; a page
 * that says "ask Peter about three things" is something a person can do.
 */

export type Priority = "high" | "medium" | "low";

export interface LooseEnd {
  fieldId: string;
  label: string;
  /** The section it belongs to, so the page reads in document order. */
  sectionTitle: string;
  type: FieldType;
  /** What was said when it was flagged. */
  note: string | null;
  whoWouldKnow: string | null;
  priority: Priority | null;
  /** The sitting that covers it, for the ones that need a conversation. */
  sittingKey: string | null;
  /** Where it falls in the template, which is the order the document prints in. */
  order: number;
}

export interface LooseEndGroup {
  /** Who might know. Null is the group nobody has been named for. */
  who: string | null;
  ends: LooseEnd[];
}

/** Template order: the same order the document prints in. */
const ORDER = new Map([...fieldsById.keys()].map((id, i) => [id, i]));

const SECTION_OF = new Map<string, string>(
  artifact.sections.flatMap((section) => sectionFields(section).map((f) => [f.id, section.title] as const)),
);

const SITTING_OF = new Map<string, string>(
  sessionTemplate.sittings.flatMap((sitting) =>
    expandCovers(sitting.covers).map((id) => [id, sitting.key] as const),
  ),
);

const RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
const rankOf = (p: Priority | null) => (p ? RANK[p] : 3);

/**
 * Groups by who might know, and orders both.
 *
 * Inside a group: how much it matters, then template order, so a group reads
 * down the document rather than in whatever order things were said.
 *
 * Between groups: the one holding the most pressing thing first, then the
 * biggest errand. The gaps nobody has been named for always come last -- not
 * because they matter least, but because they are the ones with nowhere to go,
 * and they should be what the page leaves you looking at.
 */
export function groupLooseEnds(ends: LooseEnd[]): LooseEndGroup[] {
  const groups = new Map<string, LooseEnd[]>();
  for (const end of ends) {
    // Case-folded so "peter" and "Peter" are one errand, keeping whichever
    // spelling arrived first for the heading.
    const key = end.whoWouldKnow ? end.whoWouldKnow.toLowerCase() : "";
    const existing = groups.get(key);
    if (existing) existing.push(end);
    else groups.set(key, [end]);
  }

  const out: LooseEndGroup[] = [];
  for (const [key, list] of groups) {
    list.sort((a, b) => rankOf(a.priority) - rankOf(b.priority) || a.order - b.order);
    out.push({ who: key === "" ? null : list[0].whoWouldKnow, ends: list });
  }

  return out.sort((a, b) => {
    if ((a.who === null) !== (b.who === null)) return a.who === null ? 1 : -1;
    return (
      rankOf(a.ends[0].priority) - rankOf(b.ends[0].priority) ||
      b.ends.length - a.ends.length ||
      (a.who ?? "").localeCompare(b.who ?? "")
    );
  });
}

/** How many there are, and how many have somebody to ask. */
export function countLooseEnds(ends: LooseEnd[]): { total: number; routed: number; pressing: number } {
  return {
    total: ends.length,
    routed: ends.filter((e) => e.whoWouldKnow).length,
    pressing: ends.filter((e) => e.priority === "high").length,
  };
}

interface GapRow {
  field_id: string;
  value: unknown;
  who_would_know: string | null;
  gap_priority: Priority | null;
}

export async function looseEnds(recordId: string): Promise<LooseEnd[]> {
  const rows = (await db()`
    select field_id, value, who_would_know, gap_priority
    from field_values
    where record_id = ${recordId} and status = 'unknown'`) as GapRow[];

  const ends: LooseEnd[] = [];
  for (const row of rows) {
    const field = fieldsById.get(row.field_id);
    // A field id that no longer exists in the template isn't something to ask
    // anyone about. It can only come from a record outliving a content change.
    if (!field) continue;
    ends.push({
      fieldId: field.id,
      label: field.label,
      sectionTitle: SECTION_OF.get(field.id) ?? "",
      type: field.type,
      note: typeof row.value === "string" && row.value.trim() ? row.value : null,
      whoWouldKnow: row.who_would_know?.trim() || null,
      priority: row.gap_priority,
      sittingKey: SITTING_OF.get(field.id) ?? null,
      order: ORDER.get(field.id) ?? Number.MAX_SAFE_INTEGER,
    });
  }
  return ends;
}

/** Just the number, for the places that only need to know whether there are any. */
export async function countGaps(recordId: string): Promise<number> {
  const rows = await db()`
    select count(*)::int as n from field_values
    where record_id = ${recordId} and status = 'unknown'`;
  return (rows[0] as { n: number }).n;
}
