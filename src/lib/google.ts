import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { appUrl } from "@/lib/email";

/**
 * "Sign in with Google" using the server-side authorization code flow.
 * Docs: https://developers.google.com/identity/openid-connect/openid-connect
 */

/** Short-lived cookie that ties Google's redirect back to the browser that started it. */
export const GOOGLE_STATE_COOKIE = "pakalale-google";
export const GOOGLE_STATE_MAX_AGE = 10 * 60; // seconds

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** Must match an "Authorized redirect URI" in Google Cloud Console exactly. */
export function googleRedirectUri(request: NextRequest) {
  return `${appUrl(request)}/api/auth/google/callback`;
}

const random = () => randomBytes(32).toString("base64url");

export interface GoogleState {
  state: string;
  nonce: string;
  verifier: string;
  next: string | null;
}

export function newGoogleState(next: string | null): GoogleState {
  return { state: random(), nonce: random(), verifier: random(), next };
}

export function googleAuthUrl(request: NextRequest, clientId: string, s: GoogleState) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(request),
    response_type: "code",
    scope: "openid email profile",
    state: s.state,
    nonce: s.nonce,
    // PKCE: a stolen authorization code is useless without the verifier we keep.
    code_challenge: createHash("sha256").update(s.verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return url;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  givenName?: string;
  familyName?: string;
  name?: string;
  picture?: string;
}

/** Swaps the authorization code for the user's verified profile, or throws. */
export async function exchangeGoogleCode(
  request: NextRequest,
  config: { clientId: string; clientSecret: string },
  code: string,
  s: GoogleState
): Promise<GoogleProfile> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: googleRedirectUri(request),
      grant_type: "authorization_code",
      code_verifier: s.verifier,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.id_token !== "string") {
    throw new Error(`Google token exchange failed: ${data.error || res.status}`);
  }

  // The ID token came straight from Google over TLS, so Google's docs allow
  // reading it without checking the signature. The claims are still checked.
  const claims = JSON.parse(Buffer.from(data.id_token.split(".")[1] ?? "", "base64url").toString("utf8"));
  if (
    !["https://accounts.google.com", "accounts.google.com"].includes(claims.iss) ||
    claims.aud !== config.clientId ||
    typeof claims.exp !== "number" ||
    claims.exp * 1000 < Date.now() ||
    claims.nonce !== s.nonce ||
    typeof claims.sub !== "string" ||
    typeof claims.email !== "string"
  ) {
    throw new Error("Google ID token failed validation");
  }

  return {
    sub: claims.sub,
    email: claims.email.trim().toLowerCase(),
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
    givenName: claims.given_name,
    familyName: claims.family_name,
    name: claims.name,
    picture: claims.picture,
  };
}
