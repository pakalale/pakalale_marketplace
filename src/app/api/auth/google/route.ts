import { NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/authRedirect";
import { appUrl } from "@/lib/email";
import { GOOGLE_STATE_COOKIE, GOOGLE_STATE_MAX_AGE, googleAuthUrl, googleConfig, newGoogleState } from "@/lib/google";
import { cookieOptions } from "@/lib/session";

/** Starts "Continue with Google": sends the browser to Google's account picker. */
export async function GET(request: NextRequest) {
  const config = googleConfig();
  if (!config) {
    return NextResponse.redirect(new URL("/login?error=google_unavailable", appUrl(request)));
  }

  const s = newGoogleState(safeNextPath(request.nextUrl.searchParams.get("next")));
  const response = NextResponse.redirect(googleAuthUrl(request, config.clientId, s));
  response.cookies.set(GOOGLE_STATE_COOKIE, JSON.stringify(s), {
    ...cookieOptions(request),
    path: "/api/auth/google",
    maxAge: GOOGLE_STATE_MAX_AGE,
  });
  return response;
}
