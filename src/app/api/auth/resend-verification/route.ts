import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { createEmailToken, normalizeEmail } from "@/lib/authTokens";
import { appUrl, sendVerificationEmail } from "@/lib/email";
import User from "@/models/User";

const GENERIC = { message: "If that account needs confirming, a new link is on its way." };
const attempts = new Map<string, { count: number; resetAt: number }>();

function limited(key: string) {
  const now = Date.now();
  const previous = attempts.get(key);
  if (!previous || previous.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + 15 * 60_000 });
    return false;
  }
  previous.count += 1;
  return previous.count > 5;
}

export async function POST(request: NextRequest) {
  try {
    const email = normalizeEmail((await request.json()).email);
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (limited(ip)) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });

    await connectToDatabase();
    const user = await User.findOne({ email, emailVerified: false })
      .select("+emailVerificationSentAt firstName email")
      .lean();
    if (!user || (user.emailVerificationSentAt && Date.now() - user.emailVerificationSentAt.getTime() < 60_000)) {
      return NextResponse.json(GENERIC);
    }

    const { token, hash } = createEmailToken();
    await User.updateOne({ _id: user._id }, {
      emailVerificationTokenHash: hash,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60_000),
      emailVerificationSentAt: new Date(),
    });
    const url = `${appUrl(request)}/verify-email?token=${encodeURIComponent(token)}`;
    await sendVerificationEmail(user.email, user.firstName, url);
    return NextResponse.json(GENERIC);
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json({ error: "Could not send the email. Try again shortly." }, { status: 500 });
  }
}