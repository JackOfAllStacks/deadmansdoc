"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

/**
 * Taking the document away. Printing uses the page itself rather than the
 * Markdown, so what comes out of the printer is what's on the screen; the
 * download is the Markdown, which is what anything else can read.
 */
export function DocumentActions({ markdown, filename }: { markdown: string; filename: string }) {
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

  return (
    <div className="flex flex-wrap gap-3 print:hidden">
      <Button tone="secondary" size="sm" onClick={() => window.print()}>
        Print
      </Button>
      <a
        href={`data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`}
        download={filename}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium transition-colors hover:bg-soft"
      >
        Download
      </a>
      <Button tone="secondary" size="sm" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
