"use client";

import { useActionState, useState } from "react";
import { moveSitting, type FormState } from "@/app/(app)/actions";

export function MoveSitting({ sittingId, date, min, max }: { sittingId: string; date: string; min: string; max: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = await moveSitting(prev, form);
    if (result.ok) setOpen(false);
    return result;
  }, {});

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm underline text-foreground/70">
        Change date
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="sittingId" value={sittingId} />
      <input
        type="date"
        name="date"
        defaultValue={date}
        min={min}
        max={max}
        required
        aria-label="New date"
        className="rounded-md border border-foreground/20 bg-background px-2 py-1 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-3 py-1 text-sm text-background disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-foreground/60">
        Cancel
      </button>
      {state.error && <span role="alert" className="w-full text-sm text-red-700 dark:text-red-300">{state.error}</span>}
    </form>
  );
}
