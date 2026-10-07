import { cx } from "@/components/ui";

/*
 * The mark: two cupped hands under a folded letter.
 *
 * What it deliberately isn't: a bird, which reads as afterlife imagery and is
 * exactly the glib register this product can't afford; and a handshake, which
 * is a business transaction. What it is about is custody — something held
 * carefully, and passed on. The envelope is already a real object here, so the
 * letter is a thing rather than a metaphor.
 *
 * The hands stop short of meeting at the bottom. An earlier attempt closed
 * that gap and the whole thing read as a teacup; the gap and the two thumbs
 * are what make it hands.
 *
 * Drawn on a 32-unit grid in `currentColor`, so it inherits text colour and
 * needs no second asset for dark mode.
 */
export function Mark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cx("size-8", className)}
    >
      <rect x="10" y="4.5" width="12" height="9" rx="1.3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M10.5 5.9 16 9.8l5.5-3.9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3.5 17.5c0 5 3.8 8.6 8.4 9.1" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M28.5 17.5c0 5-3.8 8.6-8.4 9.1" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M3.5 17.5 6.8 14.6" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M28.5 17.5 25.2 14.6" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
}

/**
 * For a favicon and anywhere else under about 20px, where the hands close up
 * into a blob. Keeps the letter and reduces the hands to the arc beneath it.
 */
export function MarkSmall({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cx("size-4", className)}>
      <rect x="6" y="6" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2.6" />
      <path
        d="M7 8.5 16 15l9-6.5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 23.5c0 3 5.4 5.5 12 5.5s12-2.5 12-5.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/** The mark and the name together, as they appear in the header and the hero. */
export function Wordmark({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const marks = { sm: "size-6", md: "size-7", lg: "size-11" } as const;
  const words = { sm: "text-base", md: "text-lg", lg: "text-2xl" } as const;
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <Mark className={cx(marks[size], "text-accent")} />
      <span className={cx("font-serif tracking-tight", words[size])}>The Handover</span>
    </span>
  );
}
