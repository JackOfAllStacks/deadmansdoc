import { cx } from "@/components/ui";

/*
 * Texture behind a section: geometry that gives a page some depth without
 * asking to be looked at.
 *
 * Everything is drawn in `--pattern` (the line colour, faded) or the soft
 * leaf green, and the patterns sit under a mask that fades them out, so
 * nothing has an edge. The arcs echo the mark's cupped hands. It is all
 * decoration: hidden from screen readers, and it never takes a click.
 *
 * Put it first inside a `relative isolate overflow-hidden` section.
 */
export function Backdrop({ variant, className }: { variant: "hero" | "band" | "rings" | "page"; className?: string }) {
  return (
    <div aria-hidden className={cx("pointer-events-none absolute inset-0 -z-10", className)}>
      {variant === "hero" && (
        <>
          {/* A faint dot grid, only around the drawing and gone well before
              the text. */}
          <div className="absolute inset-0 bg-dot-grid opacity-50 [mask-image:radial-gradient(ellipse_38%_55%_at_72%_50%,black,transparent)] max-lg:[mask-image:radial-gradient(ellipse_70%_35%_at_50%_75%,black,transparent)]" />
          {/* A soft green disc for the envelope to sit in front of, centred on the
              content column rather than the window so it stays behind it. */}
          <div className="absolute top-1/2 left-[calc(50%+1rem)] size-[38rem] -translate-y-1/2 rounded-full bg-leaf-soft opacity-80 max-lg:top-auto max-lg:left-auto max-lg:right-[-40%] max-lg:bottom-[-30%] max-lg:translate-y-0 max-lg:size-[34rem]" />
        </>
      )}

      {variant === "page" && (
        <>
          {/* The hero's quieter cousin, for every other page: a soft green
              circle tucked into the top corner, a faint dot grid fading out
              from it, and a few arcs low on the other side. Nothing near the
              middle, where the reading happens. */}
          <div className="absolute -top-48 -right-48 size-[34rem] rounded-full bg-leaf-soft opacity-70 max-sm:-top-32 max-sm:-right-56 max-sm:size-[22rem]" />
          <div className="absolute inset-x-0 top-0 h-[36rem] bg-dot-grid opacity-50 [mask-image:radial-gradient(ellipse_45%_70%_at_92%_0%,black,transparent)]" />
          <Arcs className="absolute -bottom-56 -left-56 size-[36rem] text-leaf opacity-25 [mask-image:linear-gradient(to_bottom,transparent_45%,black_75%)] max-sm:hidden" />
        </>
      )}

      {variant === "band" && (
        <>
          <div className="absolute inset-0 bg-leaf-soft/55" />
          <div className="absolute inset-0 bg-hatch [mask-image:linear-gradient(to_bottom,black,transparent_75%)] opacity-70" />
        </>
      )}

      {variant === "rings" && (
        <>
          <div className="absolute inset-0 bg-dot-grid [mask-image:radial-gradient(ellipse_45%_60%_at_50%_45%,black,transparent)] opacity-80" />
          <Arcs className="absolute -top-[15rem] left-1/2 size-[44rem] -translate-x-1/2 text-leaf opacity-35" />
        </>
      )}
    </div>
  );
}

/** Concentric half-rings opening upward, like the hands in the mark. */
function Arcs({ className }: { className?: string }) {
  const radii = [60, 100, 140, 180, 220, 260];
  return (
    <svg viewBox="0 0 600 600" fill="none" className={className}>
      {radii.map((r) => (
        <path key={r} d={`M${300 - r} 300 A${r} ${r} 0 0 0 ${300 + r} 300`} stroke="currentColor" strokeWidth="1.5" />
      ))}
    </svg>
  );
}
