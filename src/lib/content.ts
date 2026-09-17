import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

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
// downstream can catch a typo in these files. Fail at load instead — which,
// because this runs at module scope, means failing the build.
function validate(artifact: ArtifactDefinition, bank: QuestionBank): void {
  const problems: string[] = [];

  const fieldIds = new Set<string>();
  for (const section of artifact.sections) {
    for (const field of sectionFields(section)) {
      if (fieldIds.has(field.id)) problems.push(`duplicate field id ${field.id}`);
      fieldIds.add(field.id);
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

  if (problems.length) {
    throw new Error(`Invalid content in data/:\n  ${problems.join("\n  ")}`);
  }
}

export const artifact = load<ArtifactDefinition>("artifact-fields.yaml");
export const questionBank = load<QuestionBank>("question-bank.yaml");

validate(artifact, questionBank);

export const fieldsById: ReadonlyMap<string, Field> = new Map(
  artifact.sections.flatMap(sectionFields).map((f) => [f.id, f]),
);
