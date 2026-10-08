"use client";

import { useActionState } from "react";
import { setUpShowcaseAccounts } from "@/app/(app)/admin/actions";
import { Field } from "@/components/form";
import { Alert, Button, Card } from "@/components/ui";
import type { FormState } from "@/app/(app)/actions";
import type { ShowcaseAccount } from "@/lib/demo/showcase";

export function ShowcaseForm({ accounts }: { accounts: { email: string; label: string; exists: boolean }[] }) {
  const [state, action, pending] = useActionState<FormState & { accounts?: ShowcaseAccount[] }, FormData>(
    setUpShowcaseAccounts,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <ul className="grid gap-3 sm:grid-cols-3">
        {accounts.map((a) => (
          <li key={a.email}>
            <Card tone="plain" className="flex h-full flex-col gap-1">
              <p className="font-medium">{a.label}</p>
              <p className="text-sm break-all text-muted">{a.email}</p>
              <p className="mt-auto pt-1 text-xs text-faint">{a.exists ? "Set up" : "Not made yet"}</p>
            </Card>
          </li>
        ))}
      </ul>

      <Field
        label="Password for all three"
        name="password"
        type="text"
        autoComplete="off"
        minLength={10}
        required
        hint="This is what you'll hand out, so it's shown as you type. Setting up again changes it."
      />

      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && state.accounts && (
        <Card tone="accent" className="flex flex-col gap-1">
          <p className="font-medium">Ready.</p>
          <p className="text-sm text-muted">
            {state.accounts.filter((a) => a.created).length
              ? `Made ${state.accounts.filter((a) => a.created).length} new and reset the rest. `
              : "All three reset. "}
            Anyone signed in to them before has been signed out.
          </p>
        </Card>
      )}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Setting up…" : "Set up the three accounts"}
      </Button>
    </form>
  );
}
