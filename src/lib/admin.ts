import { db } from "@/lib/db";

// Read-only queries behind /admin. Everything here crosses account
// boundaries, so every caller must go through requireAdmin() first.

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
