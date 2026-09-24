import Link from "next/link";
import { errorCounts, listAccounts, listRecords, recentErrors, totals } from "@/lib/admin";
import { requireAdmin } from "@/lib/session";
import { RoleToggle } from "./role-toggle";

export const metadata = { title: "Admin · The Handover" };

// Failures are worth seeing as they happen, not as they were at build time.
export const dynamic = "force-dynamic";

function when(value: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Australia/Melbourne",
  }).format(new Date(value));
}

export default async function AdminPage() {
  const { user } = await requireAdmin();
  const [counts, errors, summary, accounts, records] = await Promise.all([
    errorCounts(),
    recentErrors(),
    totals(),
    listAccounts(),
    listRecords(),
  ]);

  const figures = [
    ["Accounts", summary.accounts],
    ["Records", summary.records],
    ["Opening conversations done", summary.intakes_done],
    ["Sittings done", summary.sittings_done],
  ] as const;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-foreground/70">
          Across every account. Everything here crosses account boundaries — keep it to people who need it.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {figures.map(([label, value]) => (
          <div key={label} className="rounded-md border border-foreground/15 p-4">
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
            <p className="text-sm text-foreground/60">{label}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Records</h2>
        {records.length ? (
          <ul className="flex flex-col gap-2">
            {records.map((r) => (
              <li key={r.id} className="rounded-md border border-foreground/15">
                <Link href={`/admin/records/${r.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-3 hover:bg-foreground/5">
                  <span className="flex flex-col">
                    <span className="font-medium">{r.subject_name}</span>
                    <span className="text-sm text-foreground/60">{r.owner_email}</span>
                  </span>
                  <span className="text-sm text-foreground/60">
                    {r.intake_done ? "opening conversation done" : "opening conversation unfinished"} ·{" "}
                    {r.sittings_done} of {r.sittings} sittings · {r.values} things recorded
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-foreground/70">No records yet.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">People</h2>
        <p className="text-sm text-foreground/70">
          Admins can see every account and every record, and can make other admins. Keep it to
          people who need it.
        </p>
        <ul className="flex flex-col gap-2">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border border-foreground/15 p-3"
            >
              <div className="flex flex-col">
                <span className="font-medium">
                  {a.name}
                  {a.role === "admin" && (
                    <span className="ml-2 rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-normal">admin</span>
                  )}
                </span>
                <span className="text-sm text-foreground/60">
                  {a.email} · {a.records === 1 ? "1 record" : `${a.records} records`}
                </span>
              </div>
              <RoleToggle userId={a.id} email={a.email} role={a.role} isSelf={a.id === user.id} />
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Failures, last 7 days</h2>
        {counts.length ? (
          <ul className="flex flex-wrap gap-2">
            {counts.map((c) => (
              <li key={c.error_type} className="rounded-md border border-foreground/15 px-3 py-1.5 text-sm">
                <span className="font-medium">{c.error_type}</span>{" "}
                <span className="tabular-nums text-foreground/60">×{c.n}</span>{" "}
                <span className="text-foreground/50">· last {when(c.last_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-foreground/70">Nothing has failed in the last week.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Most recent failures</h2>
        {errors.length ? (
          <ol className="flex flex-col gap-2">
            {errors.map((e) => (
              <li key={e.id} className="flex flex-col gap-1 rounded-md border border-foreground/15 p-3 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-medium">{e.error_type}</span>
                  <span className="text-foreground/60">{e.context}</span>
                  {e.status_code !== null && <span className="text-foreground/60">HTTP {e.status_code}</span>}
                  {e.model && <span className="text-foreground/60">{e.model}</span>}
                  {e.duration_ms !== null && (
                    <span className="tabular-nums text-foreground/60">{(e.duration_ms / 1000).toFixed(1)}s</span>
                  )}
                  <span className="ml-auto text-foreground/50">{when(e.created_at)}</span>
                </div>
                <p className="break-words font-mono text-xs text-foreground/80">{e.message}</p>
                {e.record_id && <p className="font-mono text-xs text-foreground/40">record {e.record_id}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-foreground/70">No failures recorded yet.</p>
        )}
      </section>
    </main>
  );
}
