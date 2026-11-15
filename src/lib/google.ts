import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { appUrl } from "@/lib/email";

export const GOOGLE_STATE_COOKIE = "pakalale-google";
export const GOOGLE_STATE_MAX_AGE = 10 * 60;

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function googleRedirectUri(request: NextRequest) {
  return `${appUrl(request)}/api/auth/google/callback`;
}

const random = () => randomBytes(32).toString("base64url");
const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export interface GoogleState {
  state: string;
  nonce: string;
  verifier: string;
  next: string | null;
  popup?: boolean;
  intent: "signin" | "signup";
}

export function newGoogleState(next: string | null, popup = false, intent: "signin" | "signup" = "signin"): GoogleState {
  return { state: random(), nonce: random(), verifier: random(), next, popup, intent };
}

export function googleAuthUrl(request: NextRequest, clientId: string, state: GoogleState) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(request),
    response_type: "code",
    scope: "openid email profile",
    state: state.state,
    nonce: state.nonce,
    code_challenge: createHash("sha256").update(state.verifier).digest("base64url"),
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

export async function exchangeGoogleCode(
  request: NextRequest,
  config: { clientId: string; clientSecret: string },
  code: string,
  state: GoogleState
): Promise<GoogleProfile> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: googleRedirectUri(request),
      grant_type: "authorization_code",
      code_verifier: state.verifier,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.id_token !== "string") {
    throw new Error(`Google token exchange failed: ${data.error || response.status}`);
  }

  const { payload: claims } = await jwtVerify(data.id_token, googleKeys, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: config.clientId,
  });
  if (
    claims.nonce !== state.nonce || typeof claims.sub !== "string" || typeof claims.email !== "string"
  ) {
    throw new Error("Google ID token failed validation");
  }

  return {
    sub: claims.sub,
    email: claims.email.trim().toLowerCase(),
    emailVerified: claims.email_verified === true,
    givenName: typeof claims.given_name === "string" ? claims.given_name : undefined,
    familyName: typeof claims.family_name === "string" ? claims.family_name : undefined,
    name: typeof claims.name === "string" ? claims.name : undefined,
    picture: typeof claims.picture === "string" ? claims.picture : undefined,
  };
}