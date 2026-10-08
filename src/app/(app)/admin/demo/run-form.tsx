"use client";

import { useActionState } from "react";
import { startDemoRun } from "@/app/(app)/admin/actions";
import { Select } from "@/components/form";
import { Alert, Button } from "@/components/ui";
import type { FormState } from "@/app/(app)/actions";

export function RunForm({ personas }: { personas: { key: string; name: string; sittings: number }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(startDemoRun, {});

  if (!personas.length) {
    return <p className="text-sm text-muted">Nobody has a script yet. Add one under script: in their persona.</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <Select label="Person" name="persona" defaultValue={personas[0].key} className="sm:max-w-sm">
        {personas.map((p) => (
          <option key={p.key} value={p.key}>
            {p.name} — the opening conversation, then {p.sittings} {p.sittings === 1 ? "sitting" : "sittings"}
          </option>
        ))}
      </Select>

      {state.error && <Alert>{state.error}</Alert>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Setting it up…" : "Watch it being made"}
      </Button>
    </form>
  );
}
