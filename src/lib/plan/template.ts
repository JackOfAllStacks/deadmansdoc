import type { SignalUpdate, SittingKey } from "@/lib/intake/signals";

type SignalName = Exclude<keyof SignalUpdate, "mentioned_sittings">;

export type CountRule = { when: SignalName; over: number; each: number; cap: number; unknown: number };
export type MatchRule = { when: SignalName; is: string | boolean; add: number; unknown: string | boolean };
export type Rule = CountRule | MatchRule;

/**
 * A plain-language area of a sitting, shown to the person before and during
 * it. `covers` is the field ids it stands for, which is what lets a topic
 * report its own progress as the conversation fills those fields in.
 */
export interface SittingTopic {
  label: string;
  blurb: string;
  covers: string[];
}

export interface SittingTemplate {
  key: SittingKey;
  title: string;
  summary: string;
  topics: SittingTopic[];
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
