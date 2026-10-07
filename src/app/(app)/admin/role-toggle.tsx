"use client";

import { useActionState, useState } from "react";
import { changeRole } from "./actions";
import type { FormState } from "@/app/(app)/actions";
import type { Role } from "@/lib/admin";

export function RoleToggle({
  userId,
  email,
  role,
  isSelf,
}: {
  userId: string;
  email: string;
  role: Role;
  isSelf: boolean;
}) {
  const next: Role = role === "admin" ? "user" : "admin";
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = await changeRole(prev, form);
    if (result.ok) setConfirming(false);
    return result;
  }, {});

  if (isSelf) {
    return <span className="text-sm text-faint">That&apos;s you</span>;
  }

  // Granting admin is one click; taking it away asks first, because the
  // person losing it may be relying on it right now.
  if (next === "user" && !confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-soft"
      >
        Remove admin
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="role" value={next} />
      {next === "user" && <span className="text-sm text-muted">Remove admin from {email}?</span>}
      <button
        type="submit"
        disabled={pending}
        className={
          next === "admin"
            ? "rounded-md border border-line px-3 py-1.5 text-sm hover:bg-soft disabled:opacity-50"
            : "rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        }
      >
        {pending ? "Saving…" : next === "admin" ? "Make admin" : "Yes, remove"}
      </button>
      {next === "user" && (
        <button type="button" onClick={() => setConfirming(false)} className="text-sm underline">
          Cancel
        </button>
      )}
      {state.error && (
        <span role="alert" className="w-full text-right text-sm text-danger">
          {state.error}
        </span>
      )}
    </form>
  );
}
