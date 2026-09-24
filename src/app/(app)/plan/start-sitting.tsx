"use client";

import { useActionState } from "react";
import { beginSitting, type FormState } from "@/app/(app)/actions";
import { Alert, Button } from "@/components/ui";

export function StartSitting({ sittingId, title }: { sittingId: string; title: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(beginSitting, {});

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="sittingId" value={sittingId} />
      <Button type="submit" disabled={pending}>
        {pending ? "Starting…" : "Start now"}
      </Button>
      <span className="sr-only">{title}</span>
      {state.error && (
        <div className="w-full">
          <Alert>{state.error}</Alert>
        </div>
      )}
    </form>
  );
}
