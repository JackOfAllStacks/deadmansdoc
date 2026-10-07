import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { fieldsById, sessionTemplate, type Disclosure } from "@/lib/content";
import { SITTING_KEYS } from "@/lib/intake/signals";

/*
 * Made-up people, so a demo doesn't need anyone to improvise answers or pay
 * for model calls to show what the product already knows how to do.
 *
 * These are written by us and are not based on anyone. Nothing real goes in
 * here -- no real names, no real numbers, no real places.
 *
 * They are checked the same way the artifact fields and question bank are:
 * a persona naming a field that doesn't exist fails the build, because the
 * database stores field ids as plain text and can't catch the typo itself.
 */

export interface PersonaEntity {
  type: string;
  label: string;
  data?: Record<string, string>;
}

export interface PersonaValue {
  field: string;
  /** Prose, or a list. Absent for a gap or a sealed figure. */
  value?: string | string[];
  /** Names an entity from `entities`, for a field that holds entries. */
  entity?: string;
  /** A sealed figure. Only ever on a field whose disclosure is sealed. */
  amount?: string;
  /**
   * A recorded gap. A name is who might know; `true` is a gap nobody has been
   * named for, which is a real state the model can produce and the worst kind
   * to have -- so a persona has to be able to show one.
   */
  unknown?: string | true;
  /** How much worse the gap gets if nobody closes it. */
  priority?: "high" | "medium" | "low";
  action?: string;
  confidence?: "stated" | "uncertain" | "inferred";
}

export interface PersonaNote {
  label: string;
  value: string;
  action?: string;
}

export interface PersonaSitting {
  key: string;
  status: "planned" | "in_progress" | "done";
  /** Days from today: negative for one already behind them. */
  day: number;
  minutes?: number;
}

export interface PersonaLine {
  sitting?: string;
  from: "agent" | "subject" | "helper";
  text: string;
}

export interface ScriptLine {
  who: string;
  says: string;
}

/**
 * What they say, for watching the product being used rather than seeding the
 * result it would have produced. Played into the real endpoints by
 * scripts/demo-run.mjs.
 */
export interface PersonaScript {
  intake: ScriptLine[];
  /** Keyed by sitting key, so a script can cover one sitting or several. */
  sittings: Record<string, ScriptLine[]>;
}

export interface Persona {
  key: string;
  name: string;
  summary: string;
  subject_name: string;
  relationship: "self" | "parent" | "other";
  present: string[];
  intake: Record<string, unknown>;
  /** Absent means the opening conversation hasn't finished. */
  intake_done?: boolean;
  sittings: PersonaSitting[];
  entities?: PersonaEntity[];
  record?: PersonaValue[];
  notes?: PersonaNote[];
  transcript?: PersonaLine[];
  script?: PersonaScript;
}

export function personaProblems(persona: Persona): string[] {
  const problems: string[] = [];
  const say = (m: string) => problems.push(`${persona.key}: ${m}`);

  if (!persona.subject_name) say("has no subject_name");
  if (!persona.present?.length) say("has nobody present");

  const templateKeys = new Set<string>(sessionTemplate.sittings.map((s) => s.key));
  const seen = new Set<string>();
  for (const sitting of persona.sittings ?? []) {
    if (!templateKeys.has(sitting.key)) say(`names unknown sitting "${sitting.key}"`);
    if (seen.has(sitting.key)) say(`lists sitting "${sitting.key}" twice`);
    seen.add(sitting.key);
  }
  for (const key of SITTING_KEYS) {
    if (!seen.has(key)) say(`is missing sitting "${key}"`);
  }

  const labels = new Set((persona.entities ?? []).map((e) => e.label));
  for (const entity of persona.entities ?? []) {
    if (!entity.label) say("has an entity with no label");
  }

  for (const row of persona.record ?? []) {
    const field = fieldsById.get(row.field);
    if (!field) {
      say(`records unknown field ${row.field}`);
      continue;
    }
    if (row.entity && !labels.has(row.entity)) {
      say(`points ${row.field} at "${row.entity}", which isn't in its entities`);
    }
    if (row.amount && field.disclosure !== "sealed") {
      say(`puts a figure on ${row.field}, which isn't sealed — it would print in the Guide`);
    }
    if (row.unknown === "") say(`${row.field} has an empty name against its gap`);
    if (field.type === "entities" && !row.entity && row.unknown === undefined) {
      say(`${row.field} holds entries, so it needs an entity or a gap`);
    }
    // Naming an entity is itself the content: "key people: Priya" records
    // Priya under that field without needing a value beside her.
    if (row.priority && row.unknown === undefined) {
      say(`${row.field} has a gap priority but isn't a gap`);
    }
    if (row.priority && !["high", "medium", "low"].includes(row.priority)) {
      say(`${row.field} has an unknown gap priority "${row.priority}"`);
    }
    if (!row.value && !row.amount && row.unknown === undefined && !row.entity) {
      say(`${row.field} has nothing recorded against it`);
    }
  }

  // A script is dialogue, so the only things that can be wrong with it are who
  // is speaking and which sitting it belongs to -- and both would only show up
  // when somebody was demonstrating the product in front of people.
  const script = persona.script;
  if (script) {
    const here = new Set(persona.present ?? []);
    const lines = [
      ...(script.intake ?? []).map((l) => ["the opening conversation", l] as const),
      ...Object.entries(script.sittings ?? {}).flatMap(([key, ls]) =>
        (ls ?? []).map((l) => [`the "${key}" sitting`, l] as const),
      ),
    ];
    for (const [where, line] of lines) {
      if (!line.says?.trim()) say(`has an empty line in ${where}`);
      if (!here.has(line.who)) say(`has ${line.who} speaking in ${where}, who isn't in the room`);
    }
    for (const key of Object.keys(script.sittings ?? {})) {
      if (!templateKeys.has(key)) say(`has a script for unknown sitting "${key}"`);
    }
  }

  const sittingKeys = new Set((persona.sittings ?? []).map((s) => s.key));
  for (const line of persona.transcript ?? []) {
    if (line.sitting && !sittingKeys.has(line.sitting)) {
      say(`has a transcript line in unknown sitting "${line.sitting}"`);
    }
  }

  return problems;
}

/** A field's own disclosure decides where a value prints; a persona can't override it. */
export function disclosureOf(fieldId: string): Disclosure {
  return fieldsById.get(fieldId)?.disclosure ?? "open";
}

function load(): Persona[] {
  const dir = join(process.cwd(), "data", "personas");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .map((f) => parse(readFileSync(join(dir, f), "utf8")) as Persona);
}

export const personas: Persona[] = load();

const problems = personas.flatMap(personaProblems);
if (problems.length) {
  throw new Error(`Invalid personas in data/personas:\n  ${problems.join("\n  ")}`);
}

export function personaByKey(key: string): Persona | undefined {
  return personas.find((p) => p.key === key);
}
