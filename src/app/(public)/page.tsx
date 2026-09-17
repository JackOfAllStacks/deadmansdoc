import Link from "next/link";
import { artifact } from "@/lib/content";

export default function Home() {
  const inScope = artifact.sections.filter((s) => artifact.scope.includes(s.number));

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-10 px-6 py-16">
      <header className="flex flex-col gap-4">
        <p className="text-sm uppercase tracking-widest text-foreground/50">In development</p>
        <h1 className="text-4xl font-semibold tracking-tight">The Handover</h1>
        <p className="text-lg leading-relaxed text-foreground/80">
          A guided conversation that records what the people you leave behind will need to
          know — who to call, what exists, and where to find it.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground/60">The first version covers</h2>
        <ol className="flex flex-col gap-2">
          {inScope.map((s) => (
            <li key={s.id} className="flex gap-3">
              <span className="w-5 text-right tabular-nums text-foreground/40">{s.number}</span>
              <span>{s.title}</span>
            </li>
          ))}
        </ol>
      </section>

      <nav className="flex items-center gap-4">
        <Link
          href="/sign-in"
          className="rounded-md bg-foreground px-4 py-2.5 font-medium text-background"
        >
          Sign in
        </Link>
        <Link href="/sign-up" className="text-foreground/80 underline">
          Create an account
        </Link>
      </nav>
    </main>
  );
}
