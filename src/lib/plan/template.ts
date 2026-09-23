import type { SignalUpdate, SittingKey } from "@/lib/intake/signals";

type SignalName = Exclude<keyof SignalUpdate, "mentioned_sittings">;

export type CountRule = { when: SignalName; over: number; each: number; cap: number; unknown: number };
export type MatchRule = { when: SignalName; is: string | boolean; add: number; unknown: string | boolean };
export type Rule = CountRule | MatchRule;

export interface SittingTemplate {
  key: SittingKey;
  title: string;
  summary: string;
  default_order: number;
  covers: string[];
  base_minutes: number;
  rules: Rule[];
}

export interface SessionTemplate {
  version: number;
  max_minutes_per_sitting: number;
  round_to_minutes: number;
  sittings: SittingTemplate[];
}

export function isCountRule(rule: Rule): rule is CountRule {
  return "over" in rule;
}
