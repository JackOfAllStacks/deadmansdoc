import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { SITTING_KEYS, signalUpdateSchema } from "@/lib/intake/signals";
import type { SessionTemplate } from "@/lib/plan/template";

export type Disclosure = "open" | "sealed" | "pointer";
export type FieldType = "text" | "list" | "ordered" | "people" | "entities";
export type Level = "high" | "medium" | "low";

export interface Field {
  id: string;
  label: string;
  disclosure: Disclosure;
  type: FieldType;
  entity?: string;
  note?: string;
}

export interface FieldGroup {
  id: string;
  title: string;
  fields: Field[];
}

export interface Section {
  id: string;
  number: number;
  title: string;
  intent: string;
  fields?: Field[];
  groups?: FieldGroup[];
}

export interface ArtifactDefinition {
  version: number;
  scope: number[];
  sections: Section[];
  entities: Record<string, string[]>;
}

export interface Question {
  id: string;
  ask: string;
  type: "generator" | "attribute" | "probe";
  entity?: string;
  domain: string;
  fills: string[];
  rank: { irreplaceability: Level; decay: Level; generativity: Level };
  priority: 1 | 2 | 3;
  routing?: boolean;
  technique?: string;
  disclosure_default?: Disclosure;
  source: "bank" | "new";
  notes?: string;
}

export interface QuestionBank {
  version: number;
  scope: number[];
  questions: Question[];
}

export interface Milestone {
  id: string;
  /** What the family could do. `{family}` is substituted; nothing else is. */
  says: string;
  /** The fields that have to hold an answer for the claim to be true. */
  needs: string[];
}

export interface MilestoneSet {
  version: number;
  milestones: Milestone[];
}

function load<T>(file: string): T {
  return parse(readFileSync(join(process.cwd(), "data", file), "utf8")) as T;
}

export function sectionFields(section: Section): Field[] {
  return [
    ...(section.fields ?? []),
    ...(section.groups ?? []).flatMap((g) => g.fields),
  ];
}

// A sitting's `covers` may name a section, a group or a single field. This
// turns any mix of those into the field ids they stand for.
export function expandCovers(refs: string[]): string[] {
  const out: string[] = [];
  for (const ref of refs) {
    const section = artifact.sections.find((s) => s.id === ref);
    if (section) {
      out.push(...sectionFields(section).map((f) => f.id));
      continue;
    }
    const group = artifact.sections.flatMap((s) => s.groups ?? []).find((g) => g.id === ref);
    if (group) {
      out.push(...group.fields.map((f) => f.id));
      continue;
    }
    if (fieldsById.has(ref)) out.push(ref);
  }
  return [...new Set(out)];
}

// The database stores field and question ids as plain text, so nothing
// downstream can catch a typo in these files. Checked at load — which, because
// this runs at module scope, means failing the build.
export function contentProblems(
  artifact: ArtifactDefinition,
  bank: QuestionBank,
  template: SessionTemplate,
  milestoneSet: MilestoneSet,
): string[] {
  const problems: string[] = [];

  const fieldIds = new Set<string>();
  // Section and group ids expand to the fields inside them.
  const expands = new Map<string, string[]>();
  for (const section of artifact.sections) {
    const fields = sectionFields(section);
    expands.set(section.id, fields.map((f) => f.id));
    for (const group of section.groups ?? []) {
      expands.set(group.id, group.fields.map((f) => f.id));
    }
    for (const field of fields) {
      if (fieldIds.has(field.id)) problems.push(`duplicate field id ${field.id}`);
      fieldIds.add(field.id);
      expands.set(field.id, [field.id]);
      if (field.type === "entities" && !(field.entity && field.entity in artifact.entities)) {
        problems.push(`field ${field.id} has unknown entity "${field.entity}"`);
      }
    }
  }

  const questionIds = new Set<string>();
  const filled = new Set<string>();
  for (const q of bank.questions) {
    if (questionIds.has(q.id)) problems.push(`duplicate question id ${q.id}`);
    questionIds.add(q.id);
    if (q.entity && !(q.entity in artifact.entities)) {
      problems.push(`question ${q.id} has unknown entity "${q.entity}"`);
    }
    for (const ref of q.fills) {
      if (!fieldIds.has(ref)) problems.push(`question ${q.id} fills unknown field ${ref}`);
      filled.add(ref);
    }
  }

  for (const id of fieldIds) {
    if (!filled.has(id)) problems.push(`field ${id} has no question that fills it`);
  }

  const signalNames = Object.keys(signalUpdateSchema.shape).filter((k) => k !== "mentioned_sittings");
  const coveredBy = new Map<string, string>();
  const templateKeys = template.sittings.map((s) => s.key);
  for (const key of SITTING_KEYS) {
    if (!templateKeys.includes(key)) problems.push(`sitting "${key}" is missing from the session template`);
  }
  for (const sitting of template.sittings) {
    if (!(SITTING_KEYS as readonly string[]).includes(sitting.key)) {
      problems.push(`sitting "${sitting.key}" isn't a known sitting key`);
    }
    for (const rule of sitting.rules) {
      if (!signalNames.includes(rule.when)) {
        problems.push(`sitting "${sitting.key}" has a rule on unknown signal "${rule.when}"`);
      }
    }
    const mine = new Set<string>();
    for (const ref of sitting.covers) {
      const ids = expands.get(ref);
      if (!ids) {
        problems.push(`sitting "${sitting.key}" covers unknown id ${ref}`);
        continue;
      }
      for (const id of ids) {
        mine.add(id);
        const other = coveredBy.get(id);
        if (other) problems.push(`field ${id} is covered by both "${other}" and "${sitting.key}"`);
        coveredBy.set(id, sitting.key);
      }
    }

    // The topics are what a person is told a sitting will cover, so they have
    // to account for all of it and promise nothing it doesn't hold.
    const inTopic = new Map<string, string>();
    for (const topic of sitting.topics ?? []) {
      for (const id of topic.covers) {
        if (!mine.has(id)) {
          problems.push(`topic "${topic.label}" claims ${id}, which "${sitting.key}" doesn't cover`);
        }
        const other = inTopic.get(id);
        if (other) problems.push(`field ${id} is in both "${other}" and "${topic.label}"`);
        inTopic.set(id, topic.label);
      }
    }
    for (const id of mine) {
      if (!inTopic.has(id)) problems.push(`field ${id} isn't in any topic of "${sitting.key}"`);
    }
  }
  for (const id of fieldIds) {
    if (!coveredBy.has(id)) problems.push(`field ${id} isn't covered by any sitting`);
  }

  // A milestone is a claim about the record said in plain words. Holding them
  // as data is only worth anything if the claim and the fields behind it can't
  // drift apart, so a milestone naming a field that doesn't exist is a build
  // failure like any other.
  const milestoneIds = new Set<string>();
  for (const milestone of milestoneSet.milestones) {
    if (milestoneIds.has(milestone.id)) problems.push(`duplicate milestone id ${milestone.id}`);
    milestoneIds.add(milestone.id);
    if (!milestone.needs.length) problems.push(`milestone "${milestone.id}" needs no fields, so it is always true`);
    if (!milestone.says.includes("{family}")) {
      problems.push(`milestone "${milestone.id}" never says whose family it is about`);
    }
    for (const ref of milestone.needs) {
      if (!fieldIds.has(ref)) problems.push(`milestone "${milestone.id}" needs unknown field ${ref}`);
    }
    // A sealed field is in the envelope, which the family only opens after a
    // death -- so it can't be the thing that makes a claim about what they
    // would know true today.
    for (const ref of milestone.needs) {
      const field = [...artifact.sections.flatMap(sectionFields)].find((f) => f.id === ref);
      if (field?.disclosure === "sealed") {
        problems.push(`milestone "${milestone.id}" needs ${ref}, which is sealed`);
      }
    }
  }

  return problems;
}

export const artifact = load<ArtifactDefinition>("artifact-fields.yaml");
export const questionBank = load<QuestionBank>("question-bank.yaml");
export const sessionTemplate = load<SessionTemplate>("session-template.yaml");
export const milestoneSet = load<MilestoneSet>("milestones.yaml");

const problems = contentProblems(artifact, questionBank, sessionTemplate, milestoneSet);
if (problems.length) {
  throw new Error(`Invalid content in data/:\n  ${problems.join("\n  ")}`);
}

export const fieldsById: ReadonlyMap<string, Field> = new Map(
  artifact.sections.flatMap(sectionFields).map((f) => [f.id, f]),
);
