"use client";

import { useActionState } from "react";
import { checkCompleteness, type CheckState } from "./actions";
import type { Standing } from "@/lib/artifact/evaluate";

const LABEL: Record<Standing, string> = {
  recorded: "recorded",
  "not-known": "known unknowns",
  "does-not-apply": "don't apply",
  "not-covered": "not covered yet",
};

const ORDER: Standing[] = ["recorded", "not-known", "does-not-apply", "not-covered"];

export function Completeness({
  recordId,
  initial,
}: {
  recordId: string;
  initial: { id: string; standing: Standing }[];
}) {
  const [state, action, pending] = useActionState<CheckState, FormData>(checkCompleteness, {});

  const standings = state.result?.fields ?? initial.map((f) => ({ id: f.id, standing: f.standing }));
  const counts = ORDER.map((s) => [s, standings.filter((f) => f.standing === s).length] as const);
  const total = standings.length;
  const settled = total - (counts.find(([s]) => s === "not-covered")?.[1] ?? 0);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">How much of the template this covers</h2>
      <p className="text-sm text-foreground/70">
        {settled} of {total} — {total ? Math.round((settled / total) * 100) : 0}%
      </p>
      <div className="flex h-2 overflow-hidden rounded-full bg-foreground/10">
        {counts.map(([standing, n]) =>
          n ? (
            <div
              key={standing}
              title={`${n} ${LABEL[standing]}`}
              style={{ width: `${(n / total) * 100}%` }}
              className={
                standing === "recorded"
                  ? "bg-foreground"
                  : standing === "not-known"
                    ? "bg-foreground/50"
                    : standing === "does-not-apply"
                      ? "bg-foreground/25"
                      : "bg-transparent"
              }
            />
          ) : null,
        )}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground/70">
        {counts.map(([standing, n]) => (
          <li key={standing}>
            <span className="tabular-nums font-medium text-foreground">{n}</span> {LABEL[standing]}
          </li>
        ))}
      </ul>

      <form action={action} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="recordId" value={recordId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
        >
          {pending ? "Reading the conversation…" : "Check what's left"}
        </button>
        <span className="text-sm text-foreground/60">
          Reads the whole conversation to tell &ldquo;not asked yet&rdquo; apart from &ldquo;doesn&apos;t apply
          to them&rdquo;. One model call.
        </span>
        {state.error && (
          <span role="alert" className="w-full text-sm text-red-700 dark:text-red-300">
            {state.error}
          </span>
        )}
      </form>

      {state.result && !state.result.judged && (
        <p className="text-sm text-foreground/70">
          The check didn&apos;t come back in a shape we could use, so nothing above has been changed.
        </p>
      )}

      {state.result?.judged && (
        <details className="text-sm">
          <summary className="cursor-pointer text-foreground/70">Why each one</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {state.result.fields
              .filter((f) => f.reason)
              .map((f) => (
                <li key={f.id} className="rounded-md border border-foreground/10 p-2">
                  <span className="text-foreground/60">{LABEL[f.standing]}</span> — {f.label}
                  <span className="block text-foreground/70">{f.reason}</span>
                </li>
              ))}
          </ul>
        </details>
      )}
    </section>
  );
}
