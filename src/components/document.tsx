import { Fragment, type ReactNode } from "react";
import type { Doc, DocSection, Entry } from "@/lib/artifact/doc";

/*
 * The documents, set to be read.
 *
 * The admin view shows the Markdown itself, because when you are tuning the
 * interview what matters is exactly what prints. This is the other audience:
 * the person whose record it is, who should see the thing they are making, not
 * its source.
 *
 * Both come from the same Doc, so there is nothing here deciding what appears
 * -- only how it looks.
 */

// The documents use exactly two inline marks, **strong** and _quiet_, and the
// renderer is the only thing that writes them. A full Markdown parser would be
// a lot of surface area for two marks nobody else can introduce.
const INLINE = /(\*\*[^*]+\*\*|_[^_]+_)/g;

export function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("_") && part.endsWith("_")) {
      return <em key={i} className="text-muted not-italic">{part.slice(1, -1)}</em>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function EntryBlock({ entry }: { entry: Entry }) {
  const asides = entry.asides.map((aside, i) => (
    <p key={i} className="mt-0.5 text-sm text-muted">
      {inline(aside)}
    </p>
  ));

  if (entry.shape === "para") {
    return (
      <div>
        {entry.lines.map((line, i) => (
          <p key={i} className="leading-relaxed">
            {inline(line)}
          </p>
        ))}
        {asides}
      </div>
    );
  }

  const List = entry.shape === "steps" ? "ol" : "ul";
  return (
    <div>
      <List
        className={
          entry.shape === "steps"
            ? "list-outside list-decimal space-y-1 pl-5 marker:text-faint"
            : "list-outside list-disc space-y-1 pl-5 marker:text-faint"
        }
      >
        {entry.lines.map((line, i) => (
          <li key={i} className="leading-relaxed">
            {inline(line)}
          </li>
        ))}
      </List>
      {asides}
    </div>
  );
}

/** A stable id per section, so the contents can link to it. */
export const sectionId = (heading: string) =>
  "s-" + heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function Section({ section }: { section: DocSection }) {
  return (
    <section id={sectionId(section.heading)} className="flex scroll-mt-6 flex-col gap-5">
      <h2 className="border-b border-line pb-2 text-xl">{section.heading}</h2>
      {section.parts.map((part, i) => (
        <div key={i} className="flex flex-col gap-2">
          {part.heading && <h3 className="font-sans text-sm font-medium text-muted">{part.heading}</h3>}
          <div className="flex flex-col gap-3">
            {part.entries.map((entry, j) => (
              <EntryBlock key={j} entry={entry} />
            ))}
          </div>
        </div>
      ))}
      {section.note && <p className="leading-relaxed text-muted">{inline(section.note)}</p>}
    </section>
  );
}

/**
 * The sections, down the side. A finished record runs to five screens, and
 * without this the only way through it is the scroll bar.
 */
export function DocumentContents({ doc }: { doc: Doc }) {
  return (
    <nav aria-label="Sections of this document" className="flex flex-col gap-2 text-sm">
      <p className="font-sans text-xs font-medium tracking-wide text-faint uppercase">In this document</p>
      <ol className="flex flex-col">
        {doc.sections.map((section) => (
          <li key={section.heading}>
            <a
              href={`#${sectionId(section.heading)}`}
              className="block rounded-md px-2 py-1.5 leading-snug text-muted transition-colors hover:bg-soft hover:text-ink"
            >
              {section.heading}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function DocumentPage({ doc }: { doc: Doc }) {
  return (
    <article className="flex flex-col gap-10">
      <header className="flex flex-col gap-4 border-b border-line pb-6">
        {/* The page around this already names it. The document carries its own
            title for print, where that page furniture is hidden. */}
        <h1 className="hidden text-3xl print:block">{doc.title}</h1>
        <dl className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-muted">
          <div className="flex gap-2">
            <dt className="font-medium">For</dt>
            <dd>{doc.forWhom}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Prepared</dt>
            <dd>{doc.prepared}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Version</dt>
            <dd>{doc.version}</dd>
          </div>
        </dl>
        <p className="measure leading-relaxed">{doc.framing}</p>
        <p className="measure text-sm leading-relaxed text-muted">{inline(doc.disclaimer)}</p>
      </header>

      {doc.sections.map((section, i) => (
        <Section key={i} section={section} />
      ))}
    </article>
  );
}
