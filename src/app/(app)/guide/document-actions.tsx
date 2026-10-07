"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

/**
 * Taking the document away.
 *
 * A Word file rather than Markdown: the people this is for open it on a shared
 * laptop, and a .md file either opens as code or doesn't open at all. Printing
 * uses the page itself, so what comes out of the printer -- or out of "save as
 * PDF" -- is what is on the screen.
 */
const LINK =
  "inline-flex items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium transition-colors hover:bg-soft";

export function DocumentActions({ markdown, downloadHref }: { markdown: string; downloadHref: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; it's on screen and downloadable anyway.
    }
  }

  const join = downloadHref.includes("?") ? "&" : "?";

  return (
    <div className="flex flex-wrap gap-3 print:hidden">
      <a href={`${downloadHref}${join}format=pdf`} className={LINK}>
        Download PDF
      </a>
      <a href={downloadHref} className={LINK}>
        Download Word
      </a>
      <Button tone="secondary" size="sm" onClick={() => window.print()}>
        Print
      </Button>
      <Button tone="secondary" size="sm" onClick={copy}>
        {copied ? "Copied" : "Copy text"}
      </Button>
    </div>
  );
}
