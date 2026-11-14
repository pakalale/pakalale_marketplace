import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { MIN_PASSWORD_LENGTH, hashEmailToken } from "@/lib/authTokens";
import { clearSessionCookie } from "@/lib/session";
import User from "@/models/User";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();
    if (typeof token !== "string" || token.length < 32) {
      return NextResponse.json({ error: "This link is not valid." }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const hashed = await bcrypt.hash(password, 12);
    const user = await User.findOneAndUpdate(
      { passwordResetTokenHash: hashEmailToken(token), passwordResetExpires: { $gt: new Date() } },
      {
        // The link proves the inbox, so it also confirms the email.
        $set: { password: hashed, passwordChangedAt: new Date(), emailVerified: true },
        $unset: { passwordResetTokenHash: 1, passwordResetExpires: 1, passwordResetSentAt: 1 },
      }
    ).lean();

    if (!user) {
      return NextResponse.json(
        { error: "This link has expired or was already used.", code: "TOKEN_INVALID" },
        { status: 400 }
      );
    }

    // passwordChangedAt signs out every existing session, including this browser's.
    const response = NextResponse.json({ message: "Password updated. Please sign in." });
    clearSessionCookie(request, response);
    return response;
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Could not reset password" }, { status: 500 });
  }
}
