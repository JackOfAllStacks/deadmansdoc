"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { SIGNUP_CODE_HEADER } from "@/lib/signup-code-header";
import { Field, FormError, SubmitButton } from "@/components/form";

const MIN_PASSWORD = 10;

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);

    const { error } = await authClient.signUp.email(
      {
        name: String(form.get("name")).trim(),
        email: String(form.get("email")),
        password: String(form.get("password")),
      },
      { headers: { [SIGNUP_CODE_HEADER]: String(form.get("code")) } },
    );

    if (error) {
      setPending(false);
      setError(
        error.status === 429
          ? "Too many attempts. Please wait a minute and try again."
          : (error.message ?? "Something went wrong creating your account. Please try again."),
      );
      return;
    }
    router.replace("/home");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Your name" name="name" autoComplete="name" required />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={MIN_PASSWORD}
        hint={`At least ${MIN_PASSWORD} characters.`}
        required
      />
      <Field
        label="Access code"
        name="code"
        autoComplete="off"
        hint="The Handover is invite-only while it's being built."
        required
      />
      <FormError message={error} />
      <SubmitButton pending={pending}>{pending ? "Creating account…" : "Create account"}</SubmitButton>
    </form>
  );
}
