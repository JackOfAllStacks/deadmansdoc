import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const PUBLIC_PATHS = new Set(["/sign-in", "/sign-up"]);

// An optimistic check only: it sees whether a session cookie exists, not
// whether it's valid. requireSession() does the real check. Signed-in users
// are deliberately not bounced away from /sign-in here — with a stale cookie
// that would loop between /sign-in and a protected page.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname) || getSessionCookie(request)) {
    return NextResponse.next();
  }
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the landing page, API routes, Next internals and files.
  matcher: ["/((?!api/|_next/|.*\\..*).+)"],
};
