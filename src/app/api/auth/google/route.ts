import { NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/authRedirect";
import { appUrl } from "@/lib/email";
import { GOOGLE_STATE_COOKIE, GOOGLE_STATE_MAX_AGE, googleAuthUrl, googleConfig, newGoogleState } from "@/lib/google";
import { cookieOptions } from "@/lib/session";

export async function GET(request: NextRequest) {
  const popup = request.nextUrl.searchParams.get("mode") === "popup";
  const config = googleConfig();
  if (!config) {
    const destination = popup
      ? "/google-done?status=error&error=google_unavailable"
      : "/login?error=google_unavailable";
    return NextResponse.redirect(new URL(destination, appUrl(request)));
  }

  const intent = request.nextUrl.searchParams.get("intent") === "signup" ? "signup" : "signin";
  const state = newGoogleState(safeNextPath(request.nextUrl.searchParams.get("next")), popup, intent);
  const response = NextResponse.redirect(googleAuthUrl(request, config.clientId, state));
  response.cookies.set(GOOGLE_STATE_COOKIE, JSON.stringify(state), {
    ...cookieOptions(request),
    path: "/api/auth/google",
    maxAge: GOOGLE_STATE_MAX_AGE,
  });
  return response;
}