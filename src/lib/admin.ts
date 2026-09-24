import { db } from "@/lib/db";

// Queries behind /admin. Everything here crosses account boundaries, so
// every caller must go through requireAdmin() first.

export type Role = "user" | "admin";

export interface Account {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  records: number;
}

export async function listAccounts(): Promise<Account[]> {
  const rows = await db()`
    select u.id, u.name, u.email, u.role, u."createdAt",
           (select count(*) from records r where r.owner_user_id = u.id)::int as records
    from "user" u
    order by u."createdAt"`;
  return rows as Account[];
}

export interface RecordSummary {
  id: string;
  subject_name: string;
  owner_email: string;
  created_at: string;
  intake_done: boolean;
  sittings: number;
  sittings_done: number;
  values: number;
}

export async function listRecords(): Promise<RecordSummary[]> {
  const rows = await db()`
    select r.id, r.subject_name, u.email as owner_email, r.created_at,
           r.intake_completed_at is not null as intake_done,
           (select count(*) from sittings s where s.record_id = r.id)::int as sittings,
           (select count(*) from sittings s where s.record_id = r.id and s.status = 'done')::int as sittings_done,
           (select count(*) from field_values f where f.record_id = r.id)::int as values
    from records r
    join "user" u on u.id = r.owner_user_id
    order by r.created_at desc`;
  return rows as RecordSummary[];
}

export type RoleChange = { ok: true; email: string; role: Role } | { ok: false; reason: string };

/**
 * Grants or removes admin. Two things it won't do: change the role of whoever
 * is asking, and remove the last admin — either would leave a page nobody can
 * reach, since only an admin can grant admin.
 *
 * The last-admin check and the update are one statement, which is as close to
 * atomic as the HTTP driver gets. Two admins demoting each other in the same
 * instant could in theory both pass; `npm run make-admin` is the way back in.
 */
export async function setRole(actorId: string, userId: string, role: Role): Promise<RoleChange> {
  if (actorId === userId) {
    return { ok: false, reason: "You can't change your own access. Ask another admin." };
  }

  const rows =
    role === "admin"
      ? await db()`update "user" set role = 'admin' where id = ${userId} returning email, role`
      : await db()`
          update "user" set role = 'user'
          where id = ${userId}
            and exists (select 1 from "user" other where other.role = 'admin' and other.id <> ${userId})
          returning email, role`;

  if (rows.length === 1) {
    const row = rows[0] as { email: string; role: Role };
    // Who changed whose access is worth being able to account for afterwards.
    console.log(JSON.stringify({ event: "role_changed", by: actorId, user: userId, to: row.role }));
    return { ok: true, email: row.email, role: row.role };
  }

  const exists = await db()`select role from "user" where id = ${userId}`;
  if (!exists.length) return { ok: false, reason: "That account no longer exists." };
  return { ok: false, reason: "That's the last admin. Make someone else an admin first." };
}

export interface ErrorRow {
  id: string;
  record_id: string | null;
  user_id: string | null;
  context: string;
  error_type: string;
  status_code: number | null;
  model: string | null;
  duration_ms: number | null;
  message: string;
  created_at: string;
}

export async function recentErrors(limit = 50): Promise<ErrorRow[]> {
  const rows = await db()`
    select id, record_id, user_id, context, error_type, status_code, model, duration_ms, message, created_at
    from error_logs
    order by created_at desc
    limit ${limit}`;
  return rows as ErrorRow[];
}

export interface ErrorCount {
  error_type: string;
  n: number;
  last_at: string;
}

// Last seven days only: an old failure that stopped happening isn't news.
export async function errorCounts(): Promise<ErrorCount[]> {
  const rows = await db()`
    select error_type, count(*)::int as n, max(created_at) as last_at
    from error_logs
    where created_at > now() - interval '7 days'
    group by error_type
    order by n desc`;
  return rows as ErrorCount[];
}

export interface Totals {
  accounts: number;
  records: number;
  intakes_done: number;
  sittings_done: number;
}

export async function totals(): Promise<Totals> {
  const rows = await db()`
    select
      (select count(*) from "user")::int                                        as accounts,
      (select count(*) from records)::int                                       as records,
      (select count(*) from records where intake_completed_at is not null)::int as intakes_done,
      (select count(*) from sittings where status = 'done')::int                as sittings_done`;
  return rows[0] as Totals;
}
