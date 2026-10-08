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
 * and links you had to know were there to go looking for. They are behind a
 * drawer instead, which gives the page back the best part of an inch.
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

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    // The page behind a drawer shouldn't scroll under it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const current = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Stays with the browser rather than scrolling away: on a long record the
  // way back out shouldn't need a journey to the top first. The width matches
  // the widest page so the header doesn't sit in from the content under it.
  return (
    <header className="app-chrome sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-[92rem] items-center gap-x-4 px-5 py-3 sm:gap-x-6 sm:px-6">
        <button
          ref={opener}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="main-nav-drawer"
          aria-label="Menu"
          className="-ml-1.5 rounded-md p-1.5 text-muted transition-colors hover:bg-soft hover:text-ink sm:hidden"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>

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

        <div className="ml-auto">{children}</div>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 sm:hidden">
          {/* Anywhere off the drawer closes it, which is how a drawer behaves
              and the only target big enough to hit without looking. Not a
              control in its own right: it would be a second thing announcing
              "close menu" to anyone listening, and Escape and the × already
              do that without a pointer. */}
          <div aria-hidden onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/30" />
          <div
            ref={panel}
            id="main-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Main"
            tabIndex={-1}
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col gap-1 border-r border-line bg-surface p-4 shadow-menu outline-none"
          >
            <div className="flex items-center justify-between pb-2">
              <Wordmark size="sm" />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  opener.current?.focus();
                }}
                aria-label="Close menu"
                className="-mr-1.5 rounded-md p-1.5 text-muted transition-colors hover:bg-soft hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <nav aria-label="Pages">
              <ul className="flex flex-col gap-1">
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
        </div>
      )}
    </header>
  );
}
