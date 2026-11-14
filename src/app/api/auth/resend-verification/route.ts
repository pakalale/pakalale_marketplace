import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { createEmailToken, normalizeEmail } from "@/lib/authTokens";
import { appUrl, sendVerificationEmail } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import User from "@/models/User";

// Same answer whether or not the account exists, so this cannot reveal who is registered.
const GENERIC = { message: "If that account needs confirming, we have sent a new link." };

export async function POST(request: NextRequest) {
  try {
    const email = normalizeEmail((await request.json()).email);
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
    if (!rateLimit(`resend:${clientIp(request)}`, 5, 15 * 60_000)) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    await connectToDatabase();
    const user = await User.findOne({ email, emailVerified: false })
      .select("+emailVerificationSentAt firstName email")
      .lean();
    // One email a minute per account.
    if (!user || (user.emailVerificationSentAt && Date.now() - user.emailVerificationSentAt.getTime() < 60_000)) {
      return NextResponse.json(GENERIC);
    }

    const { token, hash } = createEmailToken();
    await User.updateOne(
      { _id: user._id },
      {
        emailVerificationTokenHash: hash,
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60_000),
        emailVerificationSentAt: new Date(),
      }
    );
    await sendVerificationEmail(user.email, user.firstName, `${appUrl(request)}/verify-email?token=${token}`);
    return NextResponse.json(GENERIC);
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json({ error: "Could not send the email. Please try again." }, { status: 500 });
  }
}
