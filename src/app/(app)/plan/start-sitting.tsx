"use client";

import { useActionState } from "react";
import { beginSitting, type FormState } from "@/app/(app)/actions";

export function StartSitting({ sittingId, title }: { sittingId: string; title: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(beginSitting, {});

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="sittingId" value={sittingId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity disabled:opacity-50"
      >
        {pending ? "Starting…" : "Start now"}
      </button>
      <span className="sr-only">{title}</span>
      {state.error && (
        <span role="alert" className="w-full text-sm text-red-700 dark:text-red-300">
          {state.error}
        </span>
      )}
    </form>
  );
}
