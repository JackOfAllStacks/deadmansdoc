"use client";

import { useEffect } from "react";

/**
 * Light or dark, chosen here rather than only inherited from the system.
 *
 * Which one is on is a fact about the page, not about React: the script in
 * app/layout.tsx settles it before the first paint, globals.css reads the
 * attribute, and this writes the choice down. Nothing is rendered from state,
 * so there is no flash and nothing for hydration to disagree about.
 */

const KEY = "theme";

const systemPrefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

function stored(): "light" | "dark" | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function ThemeToggle() {
  // Until somebody chooses, the system is still in charge -- including when it
  // changes under us, which it does on a schedule for a lot of people.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => {
      if (!stored()) document.documentElement.dataset.theme = media.matches ? "dark" : "light";
    };
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, []);

  function toggle() {
    const showing = document.documentElement.dataset.theme ?? (systemPrefersDark() ? "dark" : "light");
    const next = showing === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private browsing, or storage turned off. The page still changes; it
      // just won't be remembered, which is better than refusing to work.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title="Switch between light and dark"
      aria-label="Switch between light and dark"
      className="rounded-md p-1.5 text-muted transition-colors hover:bg-soft hover:text-ink"
    >
      <Moon />
      <Sun />
    </button>
  );
}

const ICON = "size-[1.125rem]";
const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Showing while the page is light: press it for dark. */
function Moon() {
  return (
    <svg data-theme-icon="light" className={ICON} viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

/** Showing while the page is dark: press it for light. */
function Sun() {
  return (
    <svg data-theme-icon="dark" className={ICON} viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
