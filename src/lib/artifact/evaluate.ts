import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { artifact, sectionFields, type Field } from "@/lib/content";
import { MODEL } from "@/lib/model";
import { toToolSchema } from "@/lib/intake/signals";
import type { RecordData, TranscriptLine } from "@/lib/artifact/collect";

// How much of the template this record actually covers.
//
// Most of it is arithmetic: a field with a value is covered, a field with a
// recorded gap is known-unknown. The model is only asked the one question that
// can't be answered from the data -- whether something is missing or simply
// doesn't apply to this person. That answer usually exists only in what was
// said ("no, we don't have any pets"), never in a saved field. The idea is
// Santi's; doing it for just the outstanding fields is what keeps it cheap.

export type Standing = "recorded" | "not-known" | "does-not-apply" | "not-covered";

export interface FieldStanding {
  field: Field;
  standing: Standing;
  reason?: string;
}

export interface Completeness {
  fields: FieldStanding[];
  counts: Record<Standing, number>;
  total: number;
  /** Everything either recorded, known-unknown, or shown not to apply. */
  settledPct: number;
  judged: boolean;
}

const judgementSchema = z
  .object({
    judgements: z.array(
      z
        .object({
          field_id: z.string(),
          verdict: z
            .enum(["still-needed", "does-not-apply"])
            .describe(
              "'still-needed' unless the conversation shows this person has no such thing at all. " +
                "Not yet having been asked about is 'still-needed'.",
            ),
          evidence: z
            .string()
            .describe(
              "For 'does-not-apply', quote the words that show it. For 'still-needed', leave it empty.",
            ),
        })
        .strict(),
    ),
  })
  .strict();

function v1Fields(): Field[] {
  return artifact.sections
    .filter((s) => artifact.scope.includes(s.number))
    .flatMap((s) => sectionFields(s));
}

function transcriptText(lines: TranscriptLine[]): string {
  if (!lines.length) return "(nothing said yet)";
  return lines
    .map((l) => `${l.role === "agent" ? "Interviewer" : "Them"}: ${l.content}`)
    .join("\n")
    .slice(-24_000);
}

/** The part that needs no model at all. */
export function standingsFromData(data: RecordData): FieldStanding[] {
  return v1Fields().map((field) => {
    const rows = data.values.filter((v) => v.field_id === field.id);
    if (rows.some((r) => r.status === "answered")) return { field, standing: "recorded" as const };
    if (rows.some((r) => r.status === "unknown")) {
      const row = rows.find((r) => r.status === "unknown")!;
      return {
        field,
        standing: "not-known" as const,
        reason: row.who_would_know ? `${row.who_would_know} may know.` : "Nobody identified who would know.",
      };
    }
    return { field, standing: "not-covered" as const };
  });
}

function tally(fields: FieldStanding[], judged: boolean): Completeness {
  const counts: Record<Standing, number> = {
    recorded: 0,
    "not-known": 0,
    "does-not-apply": 0,
    "not-covered": 0,
  };
  for (const f of fields) counts[f.standing]++;
  const total = fields.length;
  const settled = total - counts["not-covered"];
  return { fields, counts, total, settledPct: total ? Math.round((settled / total) * 100) : 0, judged };
}

let anthropic: Anthropic | undefined;
const client = () => (anthropic ??= new Anthropic());

export async function assessCompleteness(data: RecordData, transcript: TranscriptLine[]): Promise<Completeness> {
  const standings = standingsFromData(data);
  const outstanding = standings.filter((s) => s.standing === "not-covered").map((s) => s.field);
  if (!outstanding.length) return tally(standings, true);

  const message = await client().beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system:
      "You are auditing one person's handover record. You are not writing anything and not interviewing anyone.\n\n" +
      "Every item listed below is one this record has NOT captured. For each, there are only two possibilities:\n\n" +
      "- 'still-needed' — it hasn't been asked about, or was asked and not answered. This is the normal state " +
      "of an unfinished record and should be your answer for almost everything.\n" +
      "- 'does-not-apply' — the person said something that shows there is no such thing in their life at all: " +
      "no business, no pets, no children, no mortgage. Quote their words as the evidence.\n\n" +
      "If you cannot quote what they said, it is 'still-needed'. Silence is not evidence, and neither is " +
      "someone saying they are finished for the day — that means the conversation ran out of time, not that " +
      "the thing doesn't exist. A record early in the process should come back almost entirely " +
      "'still-needed', and that is the correct answer, not a failure to find something.\n\n" +
      "Judge every item you are given, once each.",
    tools: [
      {
        name: "record_judgements",
        description: "Record one judgement per item.",
        input_schema: toToolSchema(judgementSchema),
        strict: true,
      },
    ],
    tool_choice: { type: "tool", name: "record_judgements" },
    messages: [
      {
        role: "user",
        content:
          `The record is about ${data.header.subject_name}.\n\n` +
          `## Still to cover\n${outstanding.map((f) => `${f.id} — ${f.label}`).join("\n")}\n\n` +
          `## What was said\n${transcriptText(transcript)}`,
      },
    ],
  });

  const call = message.content.find((b) => b.type === "tool_use");
  const parsed = call ? judgementSchema.safeParse(call.input) : null;
  if (!parsed?.success) {
    // Better an honest partial answer than a fabricated one.
    return tally(standings, false);
  }

  const byId = new Map(parsed.data.judgements.map((j) => [j.field_id, j]));
  const judged = standings.map((s) => {
    const j = byId.get(s.field.id);
    if (s.standing !== "not-covered" || !j) return s;
    // Without something they actually said, it stays outstanding. A verdict
    // with no evidence behind it is a guess, and a guess here reads as
    // "someone checked and it's fine".
    if (j.verdict === "does-not-apply" && j.evidence.trim()) {
      return { ...s, standing: "does-not-apply" as const, reason: j.evidence.trim() };
    }
    return s;
  });

  return tally(judged, true);
}
