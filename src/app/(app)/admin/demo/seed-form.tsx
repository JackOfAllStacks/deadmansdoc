"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { seedDemoRecord } from "@/app/(app)/admin/actions";
import { Select } from "@/components/form";
import { Alert, Button, Card } from "@/components/ui";
import type { FormState } from "@/app/(app)/actions";

interface Account {
  id: string;
  name: string;
  email: string;
  records: number;
}

export function SeedForm({
  personas,
  accounts,
}: {
  personas: { key: string; name: string }[];
  accounts: Account[];
}) {
  const [state, action, pending] = useActionState<FormState & { recordId?: string }, FormData>(
    seedDemoRecord,
    {},
  );
  const [persona, setPersona] = useState(personas[0]?.key ?? "");
  const [account, setAccount] = useState(accounts[0]?.id ?? "");
  const chosen = accounts.find((a) => a.id === account);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Person" name="persona" value={persona} onChange={(e) => setPersona(e.target.value)}>
          {personas.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select label="Into this account" name="userId" value={account} onChange={(e) => setAccount(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.email}
              {a.records > 0 ? " — has a record already" : ""}
            </option>
          ))}
        </Select>
      </div>

      {chosen && chosen.records > 0 && (
        <p className="text-sm text-muted">
          {chosen.email} already has a record. Seeding will replace it, and what was in it is gone.
        </p>
      )}

      {state.error && <Alert>{state.error}</Alert>}

      {state.ok && state.recordId && (
        <Card tone="accent" className="flex flex-col items-start gap-2">
          <p className="font-medium">Seeded.</p>
          <p className="text-sm text-muted">
            Sign in as {chosen?.email} to walk through it, or look at the record itself.
          </p>
          <Link href={`/admin/records/${state.recordId}`} className="text-sm underline underline-offset-4">
            Open the record
          </Link>
        </Card>
      )}

      <Button type="submit" disabled={pending || !account} className="self-start">
        {pending ? "Seeding…" : "Seed this record"}
      </Button>
    </form>
  );
}
