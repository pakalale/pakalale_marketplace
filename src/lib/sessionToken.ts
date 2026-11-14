import jwt from "jsonwebtoken";

/**
 * Session cookie format, shared by the API (src/lib/session.ts), the page
 * proxy (src/proxy.ts) and the socket server (server.ts). No database access
 * here, so it is safe to import anywhere.
 */
export const SESSION_COOKIE = "pakalale-session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

function secret() {
  const value = process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("NEXTAUTH_SECRET is required to sign sessions");
  return value;
}

export function signSessionToken(userId: string) {
  return jwt.sign({}, secret(), { algorithm: "HS256", subject: userId, expiresIn: SESSION_MAX_AGE });
}

/** The token's user id and issue time, or null when missing, forged or expired. */
export function verifySessionToken(token: string | undefined | null): { userId: string; issuedAt: number } | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, secret(), { algorithms: ["HS256"] });
    if (typeof payload !== "object" || typeof payload.sub !== "string") return null;
    return { userId: payload.sub, issuedAt: (payload.iat ?? 0) * 1000 };
  } catch {
    return null;
  }
}

/** Reads the session cookie from a raw Cookie header (for the socket server). */
export function sessionTokenFromCookieHeader(header: string | undefined) {
  const part = header
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${SESSION_COOKIE}=`));
  return part ? decodeURIComponent(part.slice(SESSION_COOKIE.length + 1)) : null;
}
