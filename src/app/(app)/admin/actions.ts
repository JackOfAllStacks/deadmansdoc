"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { setRole } from "@/lib/admin";
import { personaByKey } from "@/lib/demo/personas";
import { seedPersona } from "@/lib/demo/seed";
import { logFailure } from "@/lib/errors";
import { requireAdmin } from "@/lib/session";
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
