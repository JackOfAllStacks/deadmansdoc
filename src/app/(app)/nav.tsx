"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
 */
export function Nav({ links, children }: { links: NavLink[]; children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 sm:px-6">
        <Link href="/home" className="font-serif text-lg tracking-tight">
          The Handover
        </Link>

        <nav aria-label="Main" className="order-3 -mx-2 w-full sm:order-2 sm:mx-0 sm:w-auto">
          <ul className="flex items-center gap-1 overflow-x-auto">
            {links.map((link) => {
              // `startsWith` so /plan/new still lights up "Your plan".
              const current = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={current ? "page" : undefined}
                    className={cx(
                      "block rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors",
                      current ? "bg-soft font-medium text-ink" : "text-muted hover:bg-soft hover:text-ink",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="order-2 ml-auto sm:order-3">{children}</div>
      </div>
    </header>
  );
}
