import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { personaByKey } from "@/lib/demo/personas";
import { helperOf } from "@/lib/demo/run";
import { clearRecordsFor, seedPersona } from "@/lib/demo/seed";

/*
 * Accounts to hand to someone being shown the product: one not started, one
 * half way, one finished. Watching the ten-minute run is hard to follow, and
 * opening a record at a known point and clicking round it isn't.
 *
 * Setting them up again puts each back the way it started -- the blank one
 * emptied, the others re-seeded -- and sets every password to the one given,
 * so whatever a previous viewer did to them is gone.
 */

export const SHOWCASE = [
  { email: "demo-start@handover.test", label: "Not started", persona: null },
  { email: "demo-halfway@handover.test", label: "Half way", persona: "john" },
  { email: "demo-finished@handover.test", label: "Finished", persona: "margaret" },
] as const;

export interface ShowcaseAccount {
  email: string;
  label: string;
  created: boolean;
}

/**
 * Makes or resets all three. Admin-only, so the accounts are written through
 * the auth library directly rather than through sign-up: sign-up is rate
 * limited to a few a minute, and from a server action it would sign the admin
 * out and into whichever account it made last.
 */
export async function setUpShowcase(password: string): Promise<ShowcaseAccount[]> {
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);

  const out: ShowcaseAccount[] = [];
  for (const account of SHOWCASE) {
    const persona = account.persona ? personaByKey(account.persona) : null;
    if (account.persona && !persona) throw new Error(`No persona "${account.persona}"`);

    let userId = await userIdFor(account.email);
    const created = !userId;
    if (userId) {
      await ctx.internalAdapter.updatePassword(userId, hash);
      // Anyone still signed in from last time is signed out.
      await db()`delete from "session" where "userId" = ${userId}`;
    } else {
      // The same two calls better-auth's own admin plugin makes.
      const user = await ctx.internalAdapter.createUser(
        { email: account.email, name: persona ? helperOf(persona) : "Demo", emailVerified: false },
        { method: "admin" },
      );
      await ctx.internalAdapter.linkAccount({
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: hash,
      });
      userId = user.id;
    }

    if (persona) await seedPersona(userId, persona);
    else await clearRecordsFor(userId);
    out.push({ email: account.email, label: account.label, created });
  }
  return out;
}

async function userIdFor(email: string): Promise<string | null> {
  const rows = (await db()`select id from "user" where email = ${email}`) as { id: string }[];
  return rows[0]?.id ?? null;
}
