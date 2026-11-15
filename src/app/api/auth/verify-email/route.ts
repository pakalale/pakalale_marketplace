import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { hashEmailToken } from "@/lib/authTokens";
import { setSessionCookie } from "@/lib/session";
import User from "@/models/User";

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    if (typeof token !== "string" || token.length < 32) {
      return NextResponse.json({ error: "This link is not valid." }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findOneAndUpdate(
      { emailVerificationTokenHash: hashEmailToken(token), emailVerificationExpires: { $gt: new Date() } },
      {
        $set: { emailVerified: true },
        $unset: { emailVerificationTokenHash: 1, emailVerificationExpires: 1, emailVerificationSentAt: 1 },
      },
      { new: true }
    ).lean();

    if (!user) {
      return NextResponse.json({ error: "This link has expired or was already used." }, { status: 400 });
    }

    const response = NextResponse.json({
      user: {
        id: user._id.toString(), email: user.email, firstName: user.firstName, lastName: user.lastName,
        role: user.role, isVerified: user.isVerified, location: user.location, phone: user.phone,
        defaultAddress: user.defaultAddress, authProvider: user.authProvider || "email",
        bio: user.bio, avatar: user.avatar, createdAt: user.createdAt?.toISOString?.() || "",
        updatedAt: user.updatedAt?.toISOString?.() || "",
      },
    });
    setSessionCookie(request, response, user._id.toString());
    return response;
  } catch (error) {
    console.error("Verify email error:", error);
    return NextResponse.json({ error: "Could not verify email" }, { status: 500 });
  }
}