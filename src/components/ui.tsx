import Link from "next/link";
import type { ComponentProps, ElementType, ReactNode } from "react";

/*
 * The component vocabulary.
 *
 * Small, boring pieces that every page is built from. The rule is that a page
 * composes these and doesn't reach for a raw colour or a one-off border — if
 * something here doesn't fit, it gets a variant here rather than a private
 * copy in the page.
 */

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ── Page furniture ────────────────────────────────────────────────────────

const WIDTHS = {
  prose: "max-w-2xl",
  page: "max-w-3xl",
  wide: "max-w-5xl",
  // For the split screen only: a conversation and the document it writes,
  // side by side, both wide enough to read.
  full: "max-w-[92rem]",
} as const;

export function Page({
  width = "page",
  children,
  className,
}: {
  width?: keyof typeof WIDTHS;
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className={cx("mx-auto flex w-full flex-1 flex-col gap-8 px-5 py-10 sm:px-6", WIDTHS[width], className)}>
      {children}
    </main>
  );
}

/**
 * Every page says the same three things in the same place: where you are
 * (eyebrow), what this is (title), and what it's for (lead). Signposting is
 * the point of this branch, so it's structural rather than optional.
 */
export function PageHeader({
  eyebrow,
  title,
  lead,
  aside,
}: {
  eyebrow?: ReactNode;
  title: string;
  lead?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="flex flex-col gap-1.5">
          {eyebrow && <p className="text-sm font-medium text-faint">{eyebrow}</p>}
          <h1 className="text-3xl sm:text-4xl">{title}</h1>
        </div>
        {aside}
      </div>
      {lead && <div className="measure leading-relaxed text-muted">{lead}</div>}
    </header>
  );
}

export function SectionHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="text-xl">{children}</h2>
      {aside && <div className="text-sm text-muted">{aside}</div>}
    </div>
  );
}

// ── Cards ─────────────────────────────────────────────────────────────────

export function Card({
  tone = "plain",
  className,
  children,
}: {
  tone?: "plain" | "raised" | "quiet" | "accent";
  className?: string;
  children: ReactNode;
}) {
  const tones = {
    plain: "border-line bg-surface",
    raised: "border-line bg-surface shadow-card",
    quiet: "border-line bg-soft",
    accent: "border-accent/30 bg-accent-soft",
  } as const;
  return <div className={cx("rounded-lg border p-5", tones[tone], className)}>{children}</div>;
}

/** A card that is itself the link — the whole surface is the target. */
export function CardLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "group rounded-lg border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-soft",
        className,
      )}
    >
      {children}
    </Link>
  );
}

// ── Buttons ───────────────────────────────────────────────────────────────

const BUTTON_TONES = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-soft",
  quiet: "text-muted underline underline-offset-4 hover:text-ink",
  danger: "border border-danger/40 bg-danger-soft text-danger hover:border-danger/70",
} as const;

const BUTTON_SIZES = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5",
} as const;

export type ButtonTone = keyof typeof BUTTON_TONES;

function buttonClass(tone: ButtonTone, size: keyof typeof BUTTON_SIZES, className?: string): string {
  const shape = tone === "quiet" ? "" : cx("rounded-md font-medium", BUTTON_SIZES[size]);
  return cx(
    "inline-flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    shape,
    BUTTON_TONES[tone],
    className,
  );
}

export function Button({
  tone = "primary",
  size = "md",
  className,
  ...props
}: { tone?: ButtonTone; size?: keyof typeof BUTTON_SIZES } & ComponentProps<"button">) {
  return <button {...props} className={buttonClass(tone, size, className)} />;
}

export function ButtonLink({
  tone = "primary",
  size = "md",
  className,
  ...props
}: { tone?: ButtonTone; size?: keyof typeof BUTTON_SIZES } & ComponentProps<typeof Link>) {
  return <Link {...props} className={buttonClass(tone, size, className)} />;
}

// ── Status ────────────────────────────────────────────────────────────────

const BADGE_TONES = {
  neutral: "bg-soft text-muted",
  recorded: "bg-recorded-soft text-recorded",
  unknown: "bg-unknown-soft text-unknown",
  outstanding: "bg-outstanding-soft text-outstanding",
  accent: "bg-accent-soft text-accent",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        BADGE_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

/**
 * `also` is a second, quieter stretch of the same bar, for the places where
 * two different things both count as ground covered without meaning the same
 * thing — answers and recorded gaps. Without it the bar and the number beside
 * it can disagree, which is worse than either on its own.
 */
export function Progress({
  value,
  max,
  label,
  tone = "accent",
  also = 0,
}: {
  value: number;
  max: number;
  label: string;
  tone?: "accent" | "recorded";
  also?: number;
}) {
  const span = (n: number) => (max > 0 ? Math.max(0, Math.min(100, (n / max) * 100)) : 0);
  const first = span(value);
  const second = Math.min(100 - first, span(also));
  return (
    <div
      className="flex h-1.5 overflow-hidden rounded-full bg-soft"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value + also}
      aria-label={label}
    >
      <div
        className={cx("h-full transition-[width] duration-500", tone === "accent" ? "bg-accent" : "bg-recorded")}
        style={{ width: `${first}%` }}
      />
      {second > 0 && (
        <div className="h-full bg-unknown transition-[width] duration-500" style={{ width: `${second}%` }} />
      )}
    </div>
  );
}

/** A quiet aside — reassurance, a caveat, a reminder. Never an error. */
export function Note({ children, as: As = "p" }: { children: ReactNode; as?: ElementType }) {
  return <As className="rounded-md border border-line bg-soft px-4 py-3 text-sm text-muted">{children}</As>;
}

export function Alert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}

/** Two things side by side with a label above the value. */
export function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium tracking-wide text-faint uppercase">{label}</span>
      <span className="text-lg">{children}</span>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

// ── The sittings, by colour ───────────────────────────────────────────────

/**
 * One colour per sitting, carried everywhere that sitting appears: its card on
 * the plan and on home, its chips, and its headings in the document. The
 * colour is doing work — it tells you which part of the record you are looking
 * at before you have read anything — so these are written out in full rather
 * than built from a string, because Tailwind only sees class names it can read.
 */
export const AREA = {
  people: {
    text: "text-area-people",
    soft: "bg-area-people-soft",
    dot: "bg-area-people",
    edge: "border-l-area-people",
  },
  "first-days": {
    text: "text-area-first-days",
    soft: "bg-area-first-days-soft",
    dot: "bg-area-first-days",
    edge: "border-l-area-first-days",
  },
  "money-out": {
    text: "text-area-money-out",
    soft: "bg-area-money-out-soft",
    dot: "bg-area-money-out",
    edge: "border-l-area-money-out",
  },
  "money-in-owed": {
    text: "text-area-money-in-owed",
    soft: "bg-area-money-in-owed-soft",
    dot: "bg-area-money-in-owed",
    edge: "border-l-area-money-in-owed",
  },
} as const;

export type AreaStyle = (typeof AREA)[keyof typeof AREA];

export function areaOf(key: string): AreaStyle {
  return AREA[key as keyof typeof AREA] ?? AREA.people;
}
