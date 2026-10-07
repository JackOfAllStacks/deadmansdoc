import Link from "next/link";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { Alert, Button, cx } from "@/components/ui";

const CONTROL =
  "rounded-md border border-line-strong bg-surface px-3 py-2 text-base outline-none focus:border-accent";

export function Field({
  label,
  hint,
  className,
  ...input
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <input {...input} className={cx(CONTROL, className)} />
      {hint && <span className="text-sm text-muted">{hint}</span>}
    </label>
  );
}

export function Select({
  label,
  children,
  className,
  ...select
}: { label: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <select {...select} className={cx(CONTROL, className)}>
        {children}
      </select>
    </label>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <Button type="submit" disabled={pending}>
      {children}
    </Button>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <Alert>{message}</Alert>;
}

export function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-muted">
          The Handover
        </Link>
        <h1 className="text-3xl">{title}</h1>
      </header>
      {children}
      <p className="text-sm text-muted">{footer}</p>
    </main>
  );
}
