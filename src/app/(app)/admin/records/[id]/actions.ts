"use server";

import { z } from "zod";
import { collectRecord, getTranscript } from "@/lib/artifact/collect";
import { assessCompleteness, type Standing } from "@/lib/artifact/evaluate";
import { logFailure } from "@/lib/errors";
import { requireAdmin } from "@/lib/session";

export interface CheckState {
  error?: string;
  result?: {
    judged: boolean;
    fields: { id: string; label: string; standing: Standing; reason?: string }[];
  };
}

const schema = z.object({ recordId: z.uuid() });

// On demand, never on page load: this reads the whole conversation, so it
// costs something every time it runs.
export async function checkCompleteness(_prev: CheckState, form: FormData): Promise<CheckState> {
  const { user } = await requireAdmin();

  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Something went wrong. Please reload the page." };

  const data = await collectRecord(parsed.data.recordId);
  if (!data) return { error: "That record no longer exists." };

  try {
    const transcript = await getTranscript(parsed.data.recordId);
    const completeness = await assessCompleteness(data, transcript);
    return {
      result: {
        judged: completeness.judged,
        fields: completeness.fields.map((f) => ({
          id: f.field.id,
          label: f.field.label,
          standing: f.standing,
          reason: f.reason,
        })),
      },
    };
  } catch (err) {
    await logFailure({
      context: "admin:completeness",
      error: err,
      recordId: parsed.data.recordId,
      userId: user.id,
    });
    return { error: "The check couldn't run just now. Please try again." };
  }
}
