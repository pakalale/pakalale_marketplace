import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSessionToken, verifySessionToken } from "@/lib/sessionToken";

export type Role = "customer" | "shop_owner" | "admin";

export interface SessionUser {
  id: string;
  role: Role;
}

export function cookieOptions(request: NextRequest) {
  // Follow the real scheme (nginx sets the header) so HTTP dev and HTTPS prod both work.
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: proto === "https",
    path: "/",
  };
}

export function setSessionCookie(request: NextRequest, response: NextResponse, userId: string) {
  const token = signSessionToken(userId);
  response.cookies.set(SESSION_COOKIE, token, { ...cookieOptions(request), maxAge: SESSION_MAX_AGE });
}

export function clearSessionCookie(request: NextRequest, response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(request), maxAge: 0 });
}

/**
 * The verified caller, or null. The role comes from the database so a deleted
 * account or a changed role takes effect immediately, and a password reset
 * signs out every session issued before it.
 */
export async function getSessionUser(request: NextRequest): Promise<SessionUser | null> {
  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  await connectToDatabase();
  const user = await User.findById(session.userId).select("role passwordChangedAt").lean();
  if (!user) return null;
  // Sessions issued before the last password change no longer count.
  if (user.passwordChangedAt && session.issuedAt < user.passwordChangedAt.getTime() - 1000) {
    return null;
  }
  return { id: session.userId, role: user.role };
}

type AuthResult = { user: SessionUser; response?: undefined } | { user?: undefined; response: NextResponse };

/**
 * Guard for API routes. Signed-out callers get 401. With `roles`, other roles
 * get 403. With `actingAs`, the caller must be that user (admins excepted):
 * older clients still send their own user id, and it must match the session.
 */
export async function requireSession(
  request: NextRequest,
  options: { roles?: Role[]; actingAs?: unknown } = {}
): Promise<AuthResult> {
  const user = await getSessionUser(request);
  if (!user) {
    return { response: NextResponse.json({ error: "Please sign in to continue", code: "AUTH_REQUIRED" }, { status: 401 }) };
  }
  if (options.roles && !options.roles.includes(user.role)) {
    return { response: forbidden() };
  }
  if (
    options.actingAs !== undefined &&
    options.actingAs !== null &&
    options.actingAs !== "" &&
    String(options.actingAs) !== user.id &&
    user.role !== "admin"
  ) {
    return { response: forbidden() };
  }
  return { user };
}

export function forbidden(message = "You do not have access to this") {
  return NextResponse.json({ error: message, code: "FORBIDDEN" }, { status: 403 });
}
