"use client";

import { useState } from "react";
import { DocumentPage } from "@/components/document";
import type { Doc } from "@/lib/artifact/doc";

/**
 * The document, as the person whose record it is would see it.
 *
 * It used to show the Markdown itself, on the grounds that when you are tuning
 * the interview what matters is exactly what prints. That is still true, so it
 * is still here -- but folded away, because the first question about a record
 * is almost always what it says rather than how it is marked up.
 */
export function DocumentView({ doc, markdown, downloadHref }: { doc: Doc; markdown: string; downloadHref: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; the text is on screen and downloadable anyway.
    }
  }

  const action = "rounded-md border border-line px-3 py-1.5 text-sm hover:bg-soft";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-3 print:hidden">
        <a href={downloadHref} className={action}>
          Download for Word
        </a>
        <button onClick={() => window.print()} className={action}>
          Print or save as PDF
        </button>
        <button onClick={copy} className={action}>
          {copied ? "Copied" : "Copy Markdown"}
        </button>
      </div>

      <DocumentPage doc={doc} />

      <details className="print:hidden">
        <summary className="cursor-pointer text-sm text-muted">Markdown source</summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-md border border-line p-4 font-mono text-sm leading-relaxed">
          {markdown}
        </pre>
      </details>
    </div>
  );
}
