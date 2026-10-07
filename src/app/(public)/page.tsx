import { ButtonLink } from "@/components/ui";
import { artifact } from "@/lib/content";

export default function Home() {
  const inScope = artifact.sections.filter((s) => artifact.scope.includes(s.number));

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-10 px-5 py-16 sm:px-6">
      <header className="flex flex-col gap-4">
        <p className="text-sm font-medium tracking-wide text-faint uppercase">In development</p>
        <h1 className="text-4xl sm:text-5xl">The Handover</h1>
        <p className="measure text-lg leading-relaxed text-muted">
          A guided conversation that records what the people you leave behind will need to know —
          who to call, what exists, and where to find it.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-sans text-sm font-medium text-muted">The first version covers</h2>
        <ol className="flex flex-col gap-2">
          {inScope.map((s) => (
            <li key={s.id} className="flex gap-3 border-t border-line pt-2">
              <span className="w-5 text-right tabular-nums text-faint">{s.number}</span>
              <span>{s.title}</span>
            </li>
          ))}
        </ol>
      </section>

      <nav className="flex flex-wrap items-center gap-4">
        <ButtonLink href="/sign-in">Sign in</ButtonLink>
        <ButtonLink href="/sign-up" tone="quiet">
          Create an account
        </ButtonLink>
      </nav>
    </main>
  );
}
