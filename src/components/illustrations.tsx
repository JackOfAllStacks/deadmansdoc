import type { ReactNode } from "react";
import { Mark } from "@/components/mark";
import { cx } from "@/components/ui";

/*
 * Drawings for the landing page.
 *
 * All of them are inline SVG filled from the palette tokens -- `fill-soft`,
 * `stroke-line-strong` -- so they re-tone with everything else and need no
 * second copy for dark mode. Objects are paper: the Guide is `surface`, the
 * envelope `soft`, both drawn in the neutral lines. The only colour on them is
 * the brand's -- the mark on the seal is the same green as the mark in the
 * header -- and amber for something nobody knows yet, as everywhere else.
 *
 * Nothing here is a screenshot. A screenshot of a record about an invented
 * death invites you to read it as somebody's, and it would need re-shooting
 * whenever the interface moved.
 */

// The torn edge, left to right. Irregular on purpose: a ruler-straight zigzag
// reads as pinking shears, not a hand.
const TEAR = [
  [0, 44], [14, 38], [27, 46], [41, 36], [55, 43], [66, 37], [80, 47], [95, 39], [108, 45],
  [121, 35], [136, 42], [149, 38], [163, 47], [176, 40], [190, 44], [203, 36], [218, 45],
  [231, 39], [245, 46], [258, 37], [272, 43], [287, 38], [300, 47], [314, 40], [327, 44],
  [341, 36], [355, 45], [368, 39], [382, 46], [400, 40],
] as const;

const tearPath = TEAR.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");

/**
 * The hero: an envelope torn open along the top, with the Guide coming out of
 * it. Three layers so the page can sit *inside* the envelope -- the back of
 * the envelope behind it, the front over its lower half.
 */
export function OpenedEnvelope({ className }: { className?: string }) {
  return (
    <div
      className={cx("@container relative mx-auto aspect-[8/11] w-full max-w-[28rem] sm:aspect-[4/5]", className)}
      role="img"
      aria-label="An envelope torn open, with a page of the Guide coming out of it"
    >
      {/* Inside of the envelope, behind the page. */}
      <svg viewBox="0 0 400 200" aria-hidden className="absolute inset-x-0 bottom-0 w-full">
        <path d="M6 30 H394 V192 H6 Z" className="fill-leaf-soft stroke-line-strong" strokeWidth="1.5" />
      </svg>

      <GuidePage className="absolute inset-x-[9%] top-[3%] bottom-[16%] origin-bottom animate-[rise-from-envelope_1.1s_cubic-bezier(0.2,0.7,0.2,1)_0.2s_backwards]" />

      {/* Front of the envelope, over the lower half of the page. */}
      <svg viewBox="0 0 400 200" aria-hidden className="absolute inset-x-0 bottom-0 w-full drop-shadow-sm">
        <path
          d={`${tearPath} L400 188 Q400 198 390 198 H10 Q0 198 0 188 Z`}
          className="fill-soft stroke-line-strong"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* The folds of the back flaps, meeting under the seal. */}
        <path d="M2 196 L200 120 L398 196" className="fill-none stroke-line-strong/80" strokeWidth="1.5" />
        <path d="M2 50 L150 112 M398 50 L250 112" className="fill-none stroke-line-strong/60" strokeWidth="1.5" />
      </svg>

      {/* The wax seal, still whole: it was the top that was torn. */}
      <div className="absolute bottom-[9.5%] left-1/2 flex size-[14%] -translate-x-1/2 items-center justify-center rounded-full bg-accent shadow-card ring-4 ring-accent/20">
        <Mark className="size-[62%] text-accent-ink" />
      </div>

      {/* The strip that came off, dropped on the table beside it. */}
      <svg
        viewBox="0 0 400 30"
        aria-hidden
        className="absolute -bottom-[4%] -right-[3%] w-[42%] -rotate-[7deg] drop-shadow-sm"
      >
        <path
          d={`M0 2 L400 2 ${[...TEAR].reverse().map(([x, y]) => `L${x} ${y - 22}`).join(" ")} Z`}
          className="fill-soft stroke-line-strong"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>

      {/* Two notes from the product itself, so the picture says what it's
          like to use as well as what comes out: it goes a session at a time,
          and it keeps count. They arrive after the page has come up. */}
      <FloatingNote className="top-[5%] -right-[7%] [animation-delay:1.2s] @max-[24rem]:right-0">
        <MiniRing className="size-[2.4em] shrink-0" />
        <span className="flex flex-col leading-tight">
          <strong className="font-semibold text-ink">Session 2 of 4</strong>
          <span className="text-muted">about 15 min</span>
        </span>
      </FloatingNote>
      <FloatingNote className="bottom-[24%] -left-[8%] [animation-delay:1.45s] @max-[24rem]:left-0">
        <span className="flex size-[2.4em] shrink-0 items-center justify-center rounded-full bg-recorded-soft text-recorded">
          <svg viewBox="0 0 16 16" aria-hidden className="size-[1.2em]" fill="none">
            <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="flex flex-col leading-tight">
          <strong className="font-semibold text-ink">12 things recorded</strong>
          <span className="text-muted">2 still to find out</span>
        </span>
      </FloatingNote>
    </div>
  );
}

/**
 * A page of the Guide, small. Its type is sized off the drawing's width, so it
 * scales as one picture: in pixels it would wrap differently at every screen
 * size, and the envelope would swallow a different amount each time.
 *
 * Written in the Guide's own voice and with its
 * own furniture -- the sealed-envelope marker and a gap with a name against
 * it -- because those two are what make it different from a list of contacts.
 */
function GuidePage({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        "flex flex-col gap-[0.85em] overflow-hidden rounded-[3px] border border-line bg-surface px-[7%] pt-[6%] text-[max(9px,round(2.35cqw,1px))] leading-snug shadow-menu [text-rendering:geometricPrecision]",
        className,
      )}
    >
      <header className="flex flex-col gap-0.5 border-b border-line pb-2">
        <span className="text-[0.8em] font-medium tracking-wider text-faint uppercase">The Guide</span>
        <span className="font-serif text-[1.6em] leading-tight text-ink">For John&apos;s family</span>
        <span className="text-faint">Draft, October 2026</span>
      </header>

      <section className="flex flex-col gap-[0.3em]">
        <h4 className="font-serif text-[1.15em] text-area-people">Who to ring first</h4>
        <p className="text-ink">
          <strong className="font-semibold">Robyn, his wife.</strong> Ring her before anyone else. She knows
          where everything is.
        </p>
        {/* The first line to go when there isn't room: the page reads fine without it. */}
        <p className="text-muted @max-[23rem]:hidden">Peter, his accountant, for anything to do with money or tax.</p>
      </section>

      <section className="flex flex-col gap-[0.3em]">
        <h4 className="font-serif text-[1.15em] text-area-first-days">The first few days</h4>
        <ol className="flex flex-col gap-[0.2em] text-muted">
          <li>
            <span className="mr-[0.6em] tabular-nums text-faint">1</span>Ring the funeral director. Their card
            is in the hall drawer.
          </li>
          <li>
            <span className="mr-[0.6em] tabular-nums text-faint">2</span>Tell Centrelink within 14 days.
          </li>
        </ol>
      </section>

      <section className="flex flex-col gap-[0.4em]">
        <h4 className="font-serif text-[1.15em] text-area-money-out">Money and bills</h4>
        <p className="text-muted">Don&apos;t close the everyday account yet. The rates come out of it.</p>
        <p className="flex items-center gap-[0.5em] rounded-sm border border-dashed border-line-strong bg-soft px-[0.7em] py-[0.3em] text-muted">
          <SealIcon className="size-[1.3em] shrink-0 text-accent" />
          <em>One item here is in the sealed envelope.</em>
        </p>
        <p className="flex items-center gap-[0.5em] rounded-sm bg-unknown-soft px-[0.7em] py-[0.3em] text-unknown">
          <span aria-hidden className="font-semibold">?</span>
          <em>Tax still owing: not yet known. Peter may know.</em>
        </p>
      </section>
    </div>
  );
}

function FloatingNote({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cx(
        "absolute flex animate-[float-in_0.6s_ease-out_backwards] items-center gap-[0.7em] rounded-lg border border-line bg-surface px-[0.9em] py-[0.7em] text-[max(11px,round(2.9cqw,1px))] shadow-menu [text-rendering:geometricPrecision]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Half of a ring of four done, in the session colours. */
function MiniRing({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" aria-hidden className={className} fill="none">
      <circle cx="18" cy="18" r="14" className="stroke-leaf-soft" strokeWidth="5" />
      <path d="M18 4 A14 14 0 0 1 18 32" className="stroke-accent" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function SealIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className} fill="none">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 4.2 8 8.5l6-4.3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="8" cy="10" r="2.2" fill="currentColor" />
    </svg>
  );
}

// ── Small drawings for "How it works" ───────────────────────────────────

/** Two people and the interviewer: a question, and an answer. */
export function ConversationSpot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 72" aria-hidden className={className} fill="none">
      <rect x="6" y="8" width="64" height="30" rx="10" className="fill-surface stroke-line-strong" strokeWidth="1.5" />
      <path d="M18 38 l-4 10 12-10" className="fill-surface stroke-line-strong" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M18 20 h40 M18 27 h26" className="stroke-faint" strokeWidth="2.5" strokeLinecap="round" />
      <text x="58" y="30" className="fill-accent font-serif" fontSize="14">?</text>
      <rect x="46" y="34" width="66" height="28" rx="10" className="fill-leaf-soft stroke-leaf" strokeWidth="1.5" />
      <path d="M100 62 l4 8 -12-8" className="fill-leaf-soft stroke-leaf" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M58 45 h42 M58 52 h30" className="stroke-accent/70" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Four sessions, as four parts of one whole; two of them done. */
export function SessionsSpot({ className }: { className?: string }) {
  // Four arcs of a ring, a small gap between each.
  const arc = (from: number, to: number) => {
    const r = 26;
    const [cx, cy] = [60, 36];
    const p = (deg: number) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
    const [x1, y1] = p(from);
    const [x2, y2] = p(to);
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };
  return (
    <svg viewBox="0 0 120 72" aria-hidden className={className} fill="none">
      <path d={arc(-84, -6)} className="stroke-area-people" strokeWidth="9" strokeLinecap="round" />
      <path d={arc(6, 84)} className="stroke-area-first-days" strokeWidth="9" strokeLinecap="round" />
      <path d={arc(96, 174)} className="stroke-leaf/45" strokeWidth="9" strokeLinecap="round" />
      <path d={arc(186, 264)} className="stroke-leaf/45" strokeWidth="9" strokeLinecap="round" />
      <text x="60" y="41" textAnchor="middle" className="fill-muted" fontSize="12">
        2 of 4
      </text>
    </svg>
  );
}

/** What comes out: the Guide, and the envelope that goes with it. */
export function DocumentsSpot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 72" aria-hidden className={className} fill="none">
      <g transform="rotate(-6 40 36)">
        <rect x="20" y="4" width="44" height="60" rx="2" className="fill-surface stroke-line-strong" strokeWidth="1.5" />
        <path d="M28 14 h22" className="stroke-area-people" strokeWidth="3" strokeLinecap="round" />
        <path d="M28 23 h28 M28 30 h24 M28 37 h28 M28 44 h18" className="stroke-faint" strokeWidth="2" strokeLinecap="round" />
        <path d="M28 52 h28" className="stroke-line-strong" strokeWidth="2" strokeDasharray="3 3" />
      </g>
      <g transform="rotate(5 86 46)">
        <rect x="62" y="30" width="50" height="34" rx="3" className="fill-soft stroke-line-strong" strokeWidth="1.5" />
        <path d="M63 31 l24 17 24-17" className="stroke-line-strong" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="87" cy="48" r="6" className="fill-accent" />
      </g>
    </svg>
  );
}

// ── The two documents ───────────────────────────────────────────────────

/** The Guide, open: read whenever. */
export function GuideSheet({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" aria-hidden className={className} fill="none">
      <rect x="58" y="10" width="84" height="104" rx="3" className="fill-soft stroke-line" strokeWidth="1.5" transform="rotate(5 100 62)" />
      <rect x="58" y="6" width="84" height="104" rx="3" className="fill-surface stroke-line-strong" strokeWidth="1.5" />
      <path d="M70 20 h30" className="stroke-faint" strokeWidth="2" strokeLinecap="round" />
      <path d="M70 30 h52" className="stroke-ink" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M70 44 h20" className="stroke-area-people" strokeWidth="3" strokeLinecap="round" />
      <path d="M70 52 h58 M70 59 h48" className="stroke-faint" strokeWidth="2" strokeLinecap="round" />
      <path d="M70 70 h24" className="stroke-area-first-days" strokeWidth="3" strokeLinecap="round" />
      <path d="M70 78 h54 M70 85 h40" className="stroke-faint" strokeWidth="2" strokeLinecap="round" />
      <rect x="68" y="92" width="62" height="10" rx="2" className="fill-soft stroke-line-strong" strokeWidth="1.2" strokeDasharray="3 2" />
    </svg>
  );
}

/** The Sealed Envelope: opened only after. */
export function SealedEnvelope({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" aria-hidden className={className} fill="none">
      <rect x="36" y="22" width="128" height="84" rx="4" className="fill-soft stroke-line-strong" strokeWidth="1.5" />
      <path d="M37 23 L100 70 L163 23" className="stroke-line-strong" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M37 105 L86 62 M163 105 L114 62" className="stroke-line-strong/60" strokeWidth="1.5" />
      <circle cx="100" cy="70" r="15" className="fill-accent" />
      <circle cx="100" cy="70" r="10.5" className="stroke-accent-ink/50" strokeWidth="1.2" />
    </svg>
  );
}
