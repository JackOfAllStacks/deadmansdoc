"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { setRole } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { personaByKey } from "@/lib/demo/personas";
import { DEMO_RUN_COOKIE, helperOf, type DemoRunCookie } from "@/lib/demo/run";
import { seedPersona } from "@/lib/demo/seed";
import { logFailure } from "@/lib/errors";
import { requireAdmin } from "@/lib/session";
import { SIGNUP_CODE_HEADER } from "@/lib/signup-code-header";
import type { FormState } from "@/app/(app)/actions";

const schema = z.object({
  userId: z.string().min(1),
  role: z.enum(["user", "admin"]),
});

export async function changeRole(_prev: FormState, form: FormData): Promise<FormState> {
  // The real check. Being able to reach the page isn't the same as being
  // allowed to act on it, and a server action is its own entry point.
  const { user } = await requireAdmin();

  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Something went wrong. Please reload the page." };

  const result = await setRole(user.id, parsed.data.userId, parsed.data.role);
  if (!result.ok) return { error: result.reason };

  revalidatePath("/admin");
  return { ok: true };
}

const seedSchema = z.object({
  userId: z.string().min(1),
  persona: z.string().min(1),
});

/**
 * Fills an account with an invented person. Admin-only, like everything on
 * this page, and it replaces whatever that account had — which the form says
 * before you press it.
 */
export async function seedDemoRecord(
  _prev: FormState & { recordId?: string },
  form: FormData,
): Promise<FormState & { recordId?: string }> {
  await requireAdmin();

  const parsed = seedSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Something went wrong. Please reload the page." };

  const persona = personaByKey(parsed.data.persona);
  if (!persona) return { error: "That person isn't one we have." };

  try {
    const result = await seedPersona(parsed.data.userId, persona);
    revalidatePath("/admin");
    return { ok: true, recordId: result.recordId };
  } catch (err) {
    await logFailure({ context: "admin:seed", error: err, userId: parsed.data.userId });
    return { error: "That couldn't be seeded. The failure is in the error log." };
  }
}

const runSchema = z.object({ persona: z.string().min(1) });

/**
 * Starts a record being made in front of you. It signs this browser out of the
 * admin account and into a new one made for the run, because the run has to
 * go through the pages a person would use -- and a person's pages show a
 * person's own record.
 *
 * The account goes through real sign-up, access code and all, rather than
 * being written into the tables directly: there is no special path here, and
 * if sign-up is closed, so is this.
 */
export async function startDemoRun(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = runSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Something went wrong. Please reload the page." };

  const persona = personaByKey(parsed.data.persona);
  if (!persona?.script?.intake?.length) return { error: "That person has no script to play." };

  const code = process.env.SIGNUP_ACCESS_CODE;
  if (!code) return { error: "Sign-up is closed here (SIGNUP_ACCESS_CODE isn't set), so there's no account to run it in." };

  const email = `demo-${persona.key}-${Date.now()}@example.test`;
  // Never shown and never needed: the run signs in by itself, and the record
  // can be read afterwards from the admin pages.
  const password = randomBytes(24).toString("base64url");

  let userId: string;
  try {
    // Out first, then in. Both write the session cookie, and the last write wins.
    await auth.api.signOut({ headers: await headers() });
    const result = await auth.api.signUpEmail({
      body: { name: helperOf(persona), email, password },
      headers: new Headers({ [SIGNUP_CODE_HEADER]: code }),
    });
    userId = result.user.id;
  } catch (err) {
    await logFailure({ context: "admin:demo-run", error: err });
    return { error: "The account for the run couldn't be made. The failure is in the error log." };
  }

  const run: DemoRunCookie = { userId, persona: persona.key };
  (await cookies()).set(DEMO_RUN_COOKIE, JSON.stringify(run), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 2,
  });
  redirect("/start");
}
