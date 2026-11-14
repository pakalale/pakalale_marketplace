import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sessionToken";

/**
 * Account areas need a session before the page loads. Signed-out visitors go
 * to sign-in and come straight back afterwards. This only checks the cookie;
 * every API still checks the account and role itself.
 */
export function proxy(request: NextRequest) {
  if (verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/customer/:path*", "/shop/:path*", "/admin/:path*"],
};
