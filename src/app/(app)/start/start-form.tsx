"use client";

import { useActionState, useState } from "react";
import { startRecord, type FormState } from "@/app/(app)/actions";
import { Field, FormError, SubmitButton } from "@/components/form";

const CHOICES = [
  { value: "self", label: "Myself" },
  { value: "parent", label: "My parent" },
  { value: "other", label: "Someone else close to me" },
] as const;

export function StartForm({ accountName }: { accountName: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(startRecord, {});
  // Controlled, because React clears uncontrolled fields after a form action
  // runs — which would wipe what was typed whenever validation fails.
  const [relationship, setRelationship] = useState<string>("parent");
  const [subjectName, setSubjectName] = useState("");
  const [present, setPresent] = useState(accountName);
  const [notAWill, setNotAWill] = useState(false);
  const [consent, setConsent] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Who is this record for?</legend>
        {CHOICES.map((choice) => (
          <label key={choice.value} className="flex items-center gap-3">
            <input
              type="radio"
              name="relationship"
              value={choice.value}
              checked={relationship === choice.value}
              onChange={() => setRelationship(choice.value)}
            />
            {choice.label}
          </label>
        ))}
      </fieldset>

      {relationship !== "self" && (
        <Field
          label="Their first name"
          name="subjectName"
          autoComplete="off"
          value={subjectName}
          onChange={(e) => setSubjectName(e.target.value)}
          required
        />
      )}
      {relationship === "self" && <input type="hidden" name="subjectName" value={accountName} />}

      <Field
        label="Who's here today?"
        name="present"
        value={present}
        onChange={(e) => setPresent(e.target.value)}
        hint="First names, separated by commas. Include everyone taking part."
        required
      />

      <div className="flex flex-col gap-3 rounded-md border border-foreground/15 p-4">
        <label className="flex gap-3">
          <input
            type="checkbox"
            name="notAWill"
            checked={notAWill}
            onChange={(e) => setNotAWill(e.target.checked)}
            required
            className="mt-1"
          />
          <span>
            I understand this is not a will and has no legal effect. It records practical
            information; it doesn&apos;t decide what happens to anyone&apos;s estate.
          </span>
        </label>
        <label className="flex gap-3">
          <input
            type="checkbox"
            name="consent"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
            className="mt-1"
          />
          <span>Everyone taking part is happy to begin, and knows they can stop at any time.</span>
        </label>
      </div>

      <FormError message={state.error ?? null} />
      <SubmitButton pending={pending}>{pending ? "Starting…" : "Begin"}</SubmitButton>
    </form>
  );
}
