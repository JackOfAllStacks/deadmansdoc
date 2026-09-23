import type { Signals, SittingKey } from "@/lib/intake/signals";
import { isCountRule, type Rule, type SessionTemplate, type SittingTemplate } from "@/lib/plan/template";

export const RHYTHMS = {
  weekly: { label: "Once a week", gaps: [7] },
  fortnightly: { label: "Once a fortnight", gaps: [14] },
  "twice-weekly": { label: "Twice a week", gaps: [3, 4] },
} as const;
export type Rhythm = keyof typeof RHYTHMS;

export interface PlannedSitting {
  key: SittingKey;
  title: string;
  summary: string;
  covers: string[];
  minutes: number;
  date: string;
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

// Dates are handled as plain yyyy-mm-dd in UTC so no timezone can shift a day.
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return addDays(value, 0) === value;
}

export function buildPlan(
  signals: Signals,
  template: SessionTemplate,
  { startDate, rhythm }: { startDate: string; rhythm: Rhythm },
): PlannedSitting[] {
  if (!isIsoDate(startDate)) throw new Error(`Invalid start date: ${startDate}`);
  const step = template.round_to_minutes;
  const max = template.max_minutes_per_sitting;

  const pieces: Omit<PlannedSitting, "date">[] = [];
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

  const gaps = RHYTHMS[rhythm].gaps;
  let date = startDate;
  return pieces.map((piece, i) => {
    if (i > 0) date = addDays(date, gaps[(i - 1) % gaps.length]);
    return { ...piece, date };
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
