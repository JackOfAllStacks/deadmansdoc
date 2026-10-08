import type { Signals, SittingKey } from "@/lib/intake/signals";
import { isCountRule, type Rule, type SessionTemplate, type SittingTemplate } from "@/lib/plan/template";

export interface PlannedSitting {
  key: SittingKey;
  title: string;
  summary: string;
  covers: string[];
  minutes: number;
}

export function sittingMinutes(sitting: SittingTemplate, signals: Signals): number {
  let minutes = sitting.base_minutes;
  for (const rule of sitting.rules) minutes += ruleMinutes(rule, signals);
  return minutes;
}

function ruleMinutes(rule: Rule, signals: Signals): number {
  const known = (signals as Record<string, unknown>)[rule.when];
  if (isCountRule(rule)) {
    const value = typeof known === "number" ? known : rule.unknown;
    return Math.min(rule.cap, Math.max(0, value - rule.over) * rule.each);
  }
  const value = known === undefined ? rule.unknown : known;
  return value === rule.is ? rule.add : 0;
}

function roundTo(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step);
}

// Front-of-mind topics first, in the order they came up; the rest by the
// template's default order.
export function orderSittings(template: SessionTemplate, signals: Signals): SittingTemplate[] {
  const byDefault = [...template.sittings].sort((a, b) => a.default_order - b.default_order);
  const first = (signals.front_of_mind ?? [])
    .map((key) => byDefault.find((s) => s.key === key))
    .filter((s): s is SittingTemplate => Boolean(s));
  return [...new Set([...first, ...byDefault])];
}

/**
 * The sittings, in order, with how long each should take. There are no dates:
 * people fit these around their own lives -- one a week, or all of them in a
 * day on a visit -- and a suggested schedule only read as being told when.
 */
export function buildPlan(signals: Signals, template: SessionTemplate): PlannedSitting[] {
  const step = template.round_to_minutes;
  const max = template.max_minutes_per_sitting;

  const pieces: PlannedSitting[] = [];
  for (const sitting of orderSittings(template, signals)) {
    const total = roundTo(sittingMinutes(sitting, signals), step);
    const parts = Math.ceil(total / max);
    const base = { key: sitting.key, summary: sitting.summary, covers: sitting.covers };
    if (parts === 1) {
      pieces.push({ ...base, title: sitting.title, minutes: total });
      continue;
    }
    for (let part = 1; part <= parts; part++) {
      pieces.push({
        ...base,
        title: `${sitting.title} (part ${part} of ${parts})`,
        minutes: roundTo(total / parts, step),
      });
    }
  }

  return pieces;
}

export interface ExistingSitting {
  id: string;
  seq: number;
  sitting_key: string;
  status: "planned" | "in_progress" | "done" | "skipped";
}

export interface Revision {
  id: string;
  title: string;
  minutes: number;
  seq: number;
}

/**
 * What happens when someone goes back to the opening conversation and adds to
 * it after the plan already exists.
 *
 * The rule: a sitting that has been started is never touched. What was said in
 * it is already in the record, and re-cutting it would either lose that or
 * pretend it covered something it didn't. Only sittings still untouched are
 * rebuilt — re-estimated from the new answers and put back in whatever order
 * the new answers imply.
 *
 * The places the untouched sittings already occupy are handed out again in
 * the new order, so started sittings keep theirs.
 */
export function reviseRemaining(
  existing: ExistingSitting[],
  signals: Signals,
  template: SessionTemplate,
): Revision[] {
  const movable = existing.filter((s) => s.status === "planned");
  if (!movable.length) return [];
  // A sitting split into parts would put two rows under one key, and this
  // works key by key. No sitting can reach the split threshold today, so
  // rather than guess at how to re-cut the parts, leave the plan alone.
  if (new Set(movable.map((s) => s.sitting_key)).size !== movable.length) return [];

  const byKey = new Map(movable.map((s) => [s.sitting_key, s]));
  const slots = movable.map((s) => s.seq).sort((a, b) => a - b);
  const step = template.round_to_minutes;

  return orderSittings(template, signals)
    .filter((t) => byKey.has(t.key))
    .map((t, i) => ({
      id: byKey.get(t.key)!.id,
      title: t.title,
      minutes: roundTo(sittingMinutes(t, signals), step),
      seq: slots[i],
    }));
}

export interface ReorderRow extends ExistingSitting {
  title: string;
  estimated_minutes: number;
}

/**
 * Moving a sitting up or down the plan by hand.
 *
 * The slots stay put and the sittings move between them, so the started
 * sittings around them keep their places.
 *
 * Only sittings nobody has started can move, for the same reason they are the
 * only ones reviseRemaining will re-cut: what was said in a started sitting is
 * already in the record, and its place in the order is a matter of fact.
 */
export function reorderSlots(existing: ReorderRow[], order: string[]): Revision[] {
  const movable = existing.filter((s) => s.status === "planned");
  const byId = new Map(movable.map((s) => [s.id, s]));

  // The new order has to be exactly the movable sittings, once each. Anything
  // else is a stale page or a tampered request, and moves nothing.
  if (order.length !== movable.length) return [];
  if (new Set(order).size !== order.length) return [];
  if (!order.every((id) => byId.has(id))) return [];

  const seqs = movable.map((s) => s.seq).sort((a, b) => a - b);

  return order.map((id, i) => {
    const sitting = byId.get(id)!;
    return {
      id,
      title: sitting.title,
      minutes: sitting.estimated_minutes,
      seq: seqs[i],
    };
  });
}

export function totalMinutes(plan: { minutes: number }[]): number {
  return plan.reduce((sum, s) => sum + s.minutes, 0);
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}
