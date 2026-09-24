"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { setRole } from "@/lib/admin";
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
