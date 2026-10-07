"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Field, FormError, SubmitButton } from "@/components/form";

export function ChangeName({ name }: { name: string }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return setError("Please give a name.");
    setPending(true);
    setError(null);
    setSaved(false);
    const { error } = await authClient.updateUser({ name: trimmed });
    setPending(false);
    if (error) return setError(error.message ?? "That didn't save. Please try again.");
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Your name" name="name" value={value} onChange={(e) => setValue(e.target.value)} required />
      <FormError message={error} />
      {saved && !error && <p className="text-sm text-muted">Saved.</p>}
      <SubmitButton pending={pending}>{pending ? "Saving…" : "Save"}</SubmitButton>
    </form>
  );
}

export function DeleteAccount() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await authClient.deleteUser({ password });
    if (error) {
      setPending(false);
      return setError(
        error.status === 400 || error.status === 401
          ? "That password isn't right."
          : (error.message ?? "That didn't work. Please try again."),
      );
    }
    // The session is gone, so go somewhere public rather than bouncing off a
    // protected page.
    router.replace("/");
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="self-start rounded-md border border-danger/40 bg-danger-soft px-4 py-2 text-sm font-medium text-danger hover:border-danger/70"
      >
        Delete my account
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field
        label="Your password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        hint="Confirms it's you. There's no email step, so this is the only check."
        required
      />
      <FormError message={error} />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-red-600 px-4 py-2.5 font-medium text-white transition-opacity disabled:opacity-50"
        >
          {pending ? "Deleting…" : "Delete everything, permanently"}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setPassword("");
            setError(null);
          }}
          className="text-sm underline"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
