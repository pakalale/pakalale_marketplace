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

/** Finds the account for this Google login, linking or creating one as needed. */
async function accountFor(profile: GoogleProfile) {
  const byGoogle = await User.findOne({ googleId: profile.sub });
  if (byGoogle) return byGoogle;

  const byEmail = await User.findOne({ email: profile.email });
  if (byEmail) {
    // Google has proved this person owns the inbox, so link the accounts.
    const unset: Record<string, 1> = { emailVerificationTokenHash: 1, emailVerificationExpires: 1, emailVerificationSentAt: 1 };
    const set: Record<string, unknown> = { googleId: profile.sub, emailVerified: true };
    if (byEmail.emailVerified === false) {
      // Nobody ever confirmed this address, so whoever chose that password may
      // not be the owner. Drop it; the owner can set one via "Forgot password".
      unset.password = 1;
      set.passwordChangedAt = new Date();
    }
    if (!byEmail.avatar && profile.picture) set.avatar = profile.picture;
    await User.updateOne({ _id: byEmail._id }, { $set: set, $unset: unset });
    return User.findById(byEmail._id);
  }

  const [first, ...rest] = (profile.name || profile.email.split("@")[0]).split(" ");
  const user = await User.create({
    email: profile.email,
    googleId: profile.sub,
    firstName: profile.givenName || first,
    lastName: profile.familyName || rest.join(" "),
    avatar: profile.picture,
    role: "customer", // Shop accounts need shop details, so they sign up with the form.
    isVerified: false,
    emailVerified: true,
  });
  await createNotification({
    userId: user._id.toString(),
    type: "system",
    title: "Welcome to Pakalale! 🎉",
    message: `Hey ${user.firstName}! Start by browsing shops near you or searching for products.`,
    actionUrl: "/customer",
  }).catch((error) => console.error("Welcome notification failed:", error));
  return user;
}

/** Google sends the browser back here after the user picks an account. */
export async function GET(request: NextRequest) {
  const base = appUrl(request);
  const params = request.nextUrl.searchParams;
  const saved = readState(request);

  const finish = (query: string) => {
    const response = NextResponse.redirect(new URL(`/login?${query}`, base));
    response.cookies.set(GOOGLE_STATE_COOKIE, "", { ...cookieOptions(request), path: "/api/auth/google", maxAge: 0 });
    return response;
  };

  if (params.get("error")) return finish("error=google_cancelled");

  const config = googleConfig();
  const code = params.get("code");
  if (!config) return finish("error=google_unavailable");
  // The state must match the cookie set when this browser started the flow.
  if (!saved || !code || params.get("state") !== saved.state) return finish("error=google_failed");

  try {
    const profile = await exchangeGoogleCode(request, config, code, saved);
    if (!profile.emailVerified) return finish("error=google_unverified");

    await connectToDatabase();
    const user = await accountFor(profile);
    if (!user) return finish("error=google_failed");

    const query = new URLSearchParams({ google: "done" });
    if (saved.next) query.set("next", saved.next);
    const response = finish(query.toString());
    setSessionCookie(request, response, user._id.toString());
    return response;
  } catch (error) {
    console.error("Google sign-in error:", error);
    return finish("error=google_failed");
  }
}
