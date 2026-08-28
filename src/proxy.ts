import { NextResponse } from "next/server";

import { auth } from "@/auth";

// Optimistic check only — redirects signed-out visitors to /login for a
// clean UX. It is not the authorization boundary: every module route and
// server action re-checks the real session and the caller's per-project
// role against the database before touching data.
export const proxy = auth((req) => {
  const isLoggedIn = !!req.auth;
  const isPublicPath =
    req.nextUrl.pathname.startsWith("/login") ||
    req.nextUrl.pathname.startsWith("/api/auth");

  if (!isLoggedIn && !isPublicPath) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
