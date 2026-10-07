"use client";

import { useActionState, useState } from "react";
import { moveSitting, type FormState } from "@/app/(app)/actions";
import { Alert, Button } from "@/components/ui";

export function MoveSitting({ sittingId, date, min, max }: { sittingId: string; date: string; min: string; max: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = await moveSitting(prev, form);
    if (result.ok) setOpen(false);
    return result;
  }, {});

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-muted underline underline-offset-4 hover:text-ink">
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
        className="rounded-md border border-line-strong bg-surface px-2 py-1 text-sm"
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted">
        Cancel
      </button>
      {state.error && (
        <div className="w-full">
          <Alert>{state.error}</Alert>
        </div>
      )}
    </form>
  );
}
