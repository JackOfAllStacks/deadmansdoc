"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const ITEM = "block w-full px-4 py-2 text-left text-sm hover:bg-foreground/5";

export function AccountMenu({ name, email, admin }: { name: string; email: string; admin: boolean }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = useState(false);

  // Navigating away doesn't close a <details> on its own, which would leave
  // the menu hanging open over the page you just opened.
  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [pathname]);

  // <details> opens and closes on its own; these only add the two ways people
  // expect a menu to close, so it still works if the JavaScript never runs.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const el = menu.current;
      if (el?.open && event.target instanceof Node && !el.contains(event.target)) el.open = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const el = menu.current;
      if (el?.open && event.key === "Escape") {
        el.open = false;
        el.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <details ref={menu} className="relative">
      <summary className="cursor-pointer list-none rounded-md px-2 py-1 text-sm text-foreground/70 hover:bg-foreground/5 [&::-webkit-details-marker]:hidden">
        {name}
        <span aria-hidden className="ml-1.5 text-foreground/40">▾</span>
      </summary>
      <div className="absolute right-0 z-10 mt-1 w-56 overflow-hidden rounded-md border border-foreground/15 bg-background py-1 shadow-lg">
        <p className="truncate px-4 py-2 text-sm text-foreground/60" title={email}>
          {email}
        </p>
        <hr className="my-1 border-foreground/10" />
        <Link href="/account" className={ITEM}>
          Your account
        </Link>
        {admin && (
          <Link href="/admin" className={ITEM}>
            Admin
          </Link>
        )}
        <hr className="my-1 border-foreground/10" />
        <button onClick={signOut} disabled={pending} className={`${ITEM} disabled:opacity-50`}>
          {pending ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </details>
  );
}
