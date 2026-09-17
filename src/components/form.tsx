import Link from "next/link";
import type { InputHTMLAttributes, ReactNode } from "react";

export function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <input
        {...input}
        className="rounded-md border border-foreground/20 bg-background px-3 py-2 text-base outline-none focus:border-foreground/60 focus:ring-2 focus:ring-foreground/10"
      />
      {hint && <span className="text-sm text-foreground/60">{hint}</span>}
    </label>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-foreground px-4 py-2.5 font-medium text-background transition-opacity disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
      {message}
    </p>
  );
}

export function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-foreground/60">The Handover</Link>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </header>
      {children}
      <p className="text-sm text-foreground/70">{footer}</p>
    </main>
  );
}
