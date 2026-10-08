"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/mark";
import { cx } from "@/components/ui";

export interface NavLink {
  href: string;
  label: string;
}

/**
 * The header. Until this branch the app was one corridor — the opening
 * conversation handed you to the plan and there was no way back — so this
 * exists as much to make the product feel like a place as to move around it.
 *
 * Which links appear depends on how far someone has got: there is no point
 * offering a plan to somebody who hasn't made one.
 *
 * On a phone the links don't fit beside the wordmark, and sat on a second row
 * of their own that scrolled sideways — two rows of header above every page,
 * and links you had to know were there to go looking for. The hamburger drops
 * the header open instead, stacking them underneath, which gives the page
 * back the best part of an inch when it is shut.
 *
 * Deliberately not a drawer off the side: navigation belongs to the header,
 * and sliding it in from somewhere else makes it a different thing that
 * happens to contain the same links.
 *
 * There is no Home among them — the wordmark has always gone there, and a
 * list that repeats it is a list with a wasted line in it.
 */
export function Nav({ links, children }: { links: NavLink[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Following a link would otherwise leave the drawer open over the page it
  // just opened. Adjusted during render rather than in an effect: the drawer
  // should never be painted over the new page even once.
  const [shownOn, setShownOn] = useState(pathname);
  if (shownOn !== pathname) {
    setShownOn(pathname);
    setOpen(false);
  }

  // The two ways people expect something opened from a header to shut, beyond
  // the button itself. It stays in the flow of the page, so nothing is locked
  // and there is nothing to put focus into.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        opener.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && !opener.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const current = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Stays with the browser rather than scrolling away: on a long record the
  // way back out shouldn't need a journey to the top first. The width matches
  // the widest page so the header doesn't sit in from the content under it.
  return (
    <header className="app-chrome sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-[92rem] items-center gap-x-4 px-5 py-3 sm:gap-x-6 sm:px-6">
        <Link href="/home" aria-label="The Handover — home">
          <Wordmark size="sm" />
        </Link>

        <nav aria-label="Main" className="hidden sm:block">
          <ul className="flex items-center gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={current(link.href) ? "page" : undefined}
                  className={cx(
                    "block rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors",
                    current(link.href)
                      ? "bg-soft font-medium text-ink"
                      : "text-muted hover:bg-soft hover:text-ink",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {children}
          {links.length > 0 && (
            <button
              ref={opener}
              type="button"
              onClick={() => setOpen((was) => !was)}
              aria-expanded={open}
              aria-controls="main-nav"
              aria-label="Pages"
              className="-mr-1.5 rounded-md p-1.5 text-muted transition-colors hover:bg-soft hover:text-ink sm:hidden"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
                {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          )}
        </div>
      </div>

      {open && (
        <div
          ref={panel}
          id="main-nav"
          className="border-t border-line px-5 pt-2 pb-3 sm:hidden"
        >
          <nav aria-label="Pages">
            <ul className="flex flex-col">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={current(link.href) ? "page" : undefined}
                    className={cx(
                      "block rounded-md px-3 py-2.5 transition-colors",
                      current(link.href)
                        ? "bg-soft font-medium text-ink"
                        : "text-muted hover:bg-soft hover:text-ink",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </header>
  );
}
