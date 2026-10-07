"use client";

import { useState } from "react";

export function DocumentView({ markdown, filename }: { markdown: string; filename: string }) {
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

  const href = `data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3 print:hidden">
        <button
          onClick={copy}
          className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-soft"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <a
          href={href}
          download={filename}
          className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-soft"
        >
          Download
        </a>
        <button
          onClick={() => window.print()}
          className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-soft"
        >
          Print
        </button>
      </div>
      {/* The Markdown itself, not a rendering of it: this is the artifact, and
          what it actually says matters more than how it looks for now. */}
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border border-line p-4 font-mono text-sm leading-relaxed">
        {markdown}
      </pre>
    </div>
  );
}
