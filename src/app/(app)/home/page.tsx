import { requireSession } from "@/lib/session";

export const metadata = { title: "Home · The Handover" };

export default async function HomePage() {
  const { user } = await requireSession();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user.name}</h1>
      <p className="text-foreground/80">
        You&apos;re signed in. Getting started — a short conversation to plan your sittings — is on
        its way.
      </p>
    </main>
  );
}
