import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { appUrl } from "@/lib/email";
import { GOOGLE_STATE_COOKIE, type GoogleProfile, type GoogleState, exchangeGoogleCode, googleConfig } from "@/lib/google";
import { createNotification } from "@/lib/notifications";
import { cookieOptions, setSessionCookie } from "@/lib/session";
import User from "@/models/User";

function readState(request: NextRequest): GoogleState | null {
  try {
    const value = JSON.parse(request.cookies.get(GOOGLE_STATE_COOKIE)?.value || "");
    return typeof value?.state === "string" && typeof value?.verifier === "string" ? value : null;
  } catch {
    return null;
  }
}

async function accountFor(profile: GoogleProfile, intent: GoogleState["intent"]) {
  const byGoogle = await User.findOne({ googleId: profile.sub });
  if (byGoogle) {
    if (intent === "signup" && byGoogle.role !== "customer") throw new Error("google_account_type_exists");
    return byGoogle;
  }

  const byEmail = await User.findOne({ email: profile.email });
  if (byEmail) {
    if (byEmail.emailVerified === false) throw new Error("google_email_needs_verification");
    if (intent === "signup" && byEmail.role !== "customer") throw new Error("google_account_type_exists");
    const update: { $set: Record<string, unknown>; $unset?: Record<string, 1> } = {
      $set: { googleId: profile.sub, emailVerified: true, authProvider: "google" },
    };
    if (!byEmail.avatar && profile.picture) update.$set.avatar = profile.picture;
    const linked = await User.findByIdAndUpdate(byEmail._id, update, { new: true });
    return linked;
  }

  const [firstName, ...lastParts] = (profile.name || profile.email.split("@")[0]).split(" ");
  const user = await User.create({
    email: profile.email,
    googleId: profile.sub,
    authProvider: "google",
    firstName: profile.givenName || firstName,
    lastName: profile.familyName || lastParts.join(" "),
    avatar: profile.picture,
    role: "customer",
    isVerified: false,
    emailVerified: true,
  });
  await createNotification({
    userId: user._id.toString(),
    type: "system",
    title: "Welcome to Pakalale!",
    message: `Hey ${user.firstName}! Start by browsing shops and products.`,
    actionUrl: "/customer",
  }).catch((error) => console.error("Welcome notification failed:", error));
  return user;
}

export async function GET(request: NextRequest) {
  const base = appUrl(request);
  const params = request.nextUrl.searchParams;
  const state = readState(request);
  const finish = (query: string) => {
    const isError = query.startsWith("error=");
    const destination = state?.popup
      ? `/google-done?${isError ? `status=error&${query}` : "status=done"}`
      : `/login?${query}`;
    const response = NextResponse.redirect(new URL(destination, base), 303);
    response.cookies.set(GOOGLE_STATE_COOKIE, "", { ...cookieOptions(request), path: "/api/auth/google", maxAge: 0 });
    return response;
  };

  if (params.get("error")) return finish("error=google_cancelled");
  const config = googleConfig();
  const code = params.get("code");
  if (!config) return finish("error=google_unavailable");
  if (!state || !code || params.get("state") !== state.state) return finish("error=google_failed");

  try {
    const profile = await exchangeGoogleCode(request, config, code, state);
    if (!profile.emailVerified) return finish("error=google_unverified");
    await connectToDatabase();
    const user = await accountFor(profile, state.intent || "signin");
    if (!user) return finish("error=google_failed");

    const query = new URLSearchParams({ google: "done" });
    if (state.next) query.set("next", state.next);
    const response = finish(query.toString());
    setSessionCookie(request, response, user._id.toString());
    return response;
  } catch (error) {
    console.error("Google sign-in error:", error);
    const code = error instanceof Error && ["google_email_needs_verification", "google_account_type_exists"].includes(error.message)
      ? error.message
      : "google_failed";
    return finish(`error=${code}`);
  }
}