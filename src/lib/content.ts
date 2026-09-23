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

function load<T>(file: string): T {
  return parse(readFileSync(join(process.cwd(), "data", file), "utf8")) as T;
}

export function sectionFields(section: Section): Field[] {
  return [
    ...(section.fields ?? []),
    ...(section.groups ?? []).flatMap((g) => g.fields),
  ];
}

// The database stores field and question ids as plain text, so nothing
// downstream can catch a typo in these files. Checked at load — which, because
// this runs at module scope, means failing the build.
export function contentProblems(
  artifact: ArtifactDefinition,
  bank: QuestionBank,
  template: SessionTemplate,
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
    for (const ref of sitting.covers) {
      const ids = expands.get(ref);
      if (!ids) {
        problems.push(`sitting "${sitting.key}" covers unknown id ${ref}`);
        continue;
      }
      for (const id of ids) {
        const other = coveredBy.get(id);
        if (other) problems.push(`field ${id} is covered by both "${other}" and "${sitting.key}"`);
        coveredBy.set(id, sitting.key);
      }
    }
  }
  for (const id of fieldIds) {
    if (!coveredBy.has(id)) problems.push(`field ${id} isn't covered by any sitting`);
  }

  return problems;
}

export const artifact = load<ArtifactDefinition>("artifact-fields.yaml");
export const questionBank = load<QuestionBank>("question-bank.yaml");
export const sessionTemplate = load<SessionTemplate>("session-template.yaml");

const problems = contentProblems(artifact, questionBank, sessionTemplate);
if (problems.length) {
  throw new Error(`Invalid content in data/:\n  ${problems.join("\n  ")}`);
}

export const fieldsById: ReadonlyMap<string, Field> = new Map(
  artifact.sections.flatMap(sectionFields).map((f) => [f.id, f]),
);
