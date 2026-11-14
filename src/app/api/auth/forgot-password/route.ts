import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { createEmailToken, normalizeEmail } from "@/lib/authTokens";
import { appUrl, sendPasswordResetEmail } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import User from "@/models/User";

// Same answer whether or not the account exists, so this cannot reveal who is registered.
const GENERIC = { message: "If an account uses that email, we have sent a reset link." };

export async function POST(request: NextRequest) {
  try {
    const email = normalizeEmail((await request.json()).email);
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
    if (!rateLimit(`forgot:${clientIp(request)}`, 5, 15 * 60_000)) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    await connectToDatabase();
    const user = await User.findOne({ email }).select("+passwordResetSentAt firstName email").lean();
    if (!user || (user.passwordResetSentAt && Date.now() - user.passwordResetSentAt.getTime() < 60_000)) {
      return NextResponse.json(GENERIC);
    }

    const { token, hash } = createEmailToken();
    await User.updateOne(
      { _id: user._id },
      {
        passwordResetTokenHash: hash,
        passwordResetExpires: new Date(Date.now() + 60 * 60_000),
        passwordResetSentAt: new Date(),
      }
    );
    await sendPasswordResetEmail(user.email, user.firstName, `${appUrl(request)}/reset-password?token=${token}`);
    return NextResponse.json(GENERIC);
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Could not send the email. Please try again." }, { status: 500 });
  }
}
