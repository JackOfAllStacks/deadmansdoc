import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

// The real access check. The proxy only looks for a cookie; every protected
// layout, route handler and server action must call this.
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

export function isAdmin(user: { role?: string | null }): boolean {
  return user.role === "admin";
}

// Admin pages 404 rather than redirect, so their existence isn't advertised
// to someone who shouldn't have them.
export async function requireAdmin() {
  const session = await requireSession();
  if (!isAdmin(session.user)) notFound();
  return session;
}

// Only same-site paths, so ?next= can't send someone to another origin.
export function safeNextPath(next: string | string[] | undefined): string {
  const value = Array.isArray(next) ? next[0] : next;
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/home";
  }
  return value;
}
