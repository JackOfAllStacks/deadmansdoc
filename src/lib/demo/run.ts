import { cookies } from "next/headers";
import { z } from "zod";
import { sessionTemplate } from "@/lib/content";
import { personaByKey, type Persona, type ScriptLine } from "@/lib/demo/personas";

/*
 * Watching a record being made, from the admin dashboard rather than a
 * terminal. scripts/demo-run.mjs drives a browser with Playwright, which can't
 * run on Netlify; this plays the same lines into the same pages from inside
 * the browser that is watching, so it works wherever the app does.
 *
 * Which run is playing lives in a cookie, set when the admin starts it. It
 * names the account it was made for, so it can't be carried into another one.
 */

export const DEMO_RUN_COOKIE = "demo-run";

const cookieSchema = z.object({
  userId: z.string().min(1),
  persona: z.string().min(1),
});

export type DemoRunCookie = z.infer<typeof cookieSchema>;

/** Everything the player needs, and nothing it doesn't: plain data for the client. */
export interface DemoRun {
  /** Unique to this run, so progress kept in the browser can't leak into the next one. */
  id: string;
  name: string;
  subjectName: string;
  relationship: Persona["relationship"];
  present: string[];
  intake: ScriptLine[];
  /** Every sitting the persona has words for. A run plays them in the plan's order, not this one. */
  sittings: DemoSitting[];
}

export interface DemoSitting {
  key: string;
  title: string;
  lines: ScriptLine[];
}

/** The sittings a run can play: the ones the persona has words for, in the template's order. */
export function scriptedSittings(persona: Persona): DemoSitting[] {
  return sessionTemplate.sittings.flatMap((s) => {
    const lines = persona.script?.sittings?.[s.key];
    return lines?.length ? [{ key: s.key, title: s.title, lines }] : [];
  });
}

/** Whoever is helping is the one holding the keyboard, so the account is theirs. */
export function helperOf(persona: Persona): string {
  return persona.present.find((n) => n !== persona.subject_name) ?? persona.present[0];
}

export async function demoRunFor(userId: string): Promise<DemoRun | null> {
  const raw = (await cookies()).get(DEMO_RUN_COOKIE)?.value;
  if (!raw) return null;

  let parsed: DemoRunCookie;
  try {
    parsed = cookieSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
  if (parsed.userId !== userId) return null;

  const persona = personaByKey(parsed.persona);
  if (!persona?.script) return null;

  return {
    id: parsed.userId,
    name: persona.name,
    subjectName: persona.subject_name,
    relationship: persona.relationship,
    present: persona.present,
    intake: persona.script.intake,
    sittings: scriptedSittings(persona),
  };
}
