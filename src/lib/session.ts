import jwt from "jsonwebtoken";
import type { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";

const SESSION_COOKIE = "pakalale-session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

export interface SessionUser {
  id: string;
  role: "customer" | "shop_owner" | "admin";
}

function sessionSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required to sign sessions");
  return secret;
}

function cookieOptions(request: NextRequest) {
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
  const token = jwt.sign({}, sessionSecret(), {
    algorithm: "HS256",
    subject: userId,
    expiresIn: SESSION_MAX_AGE,
  });
  response.cookies.set(SESSION_COOKIE, token, { ...cookieOptions(request), maxAge: SESSION_MAX_AGE });
}

export function clearSessionCookie(request: NextRequest, response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(request), maxAge: 0 });
}

/**
 * The verified caller, or null. The role comes from the database so a deleted
 * account or a changed role takes effect immediately.
 */
export async function getSessionUser(request: NextRequest): Promise<SessionUser | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let userId: string | undefined;
  try {
    userId = jwt.verify(token, sessionSecret(), { algorithms: ["HS256"] }).sub as string | undefined;
  } catch {
    return null;
  }
  if (!userId) return null;

  await connectToDatabase();
  const user = await User.findById(userId).select("role").lean();
  return user ? { id: userId, role: user.role } : null;
}
