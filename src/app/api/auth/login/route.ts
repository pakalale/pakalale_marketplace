import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { setSessionCookie } from "@/lib/session";
import User from "@/models/User";
import { normalizeEmail } from "@/lib/authTokens";

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const email = normalizeEmail(body.email);
    const { password } = body;

    if (!email || typeof password !== "string" || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await User.findOne({ email }).lean();
    if (!user?.password) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (user.emailVerified === false) {
      return NextResponse.json(
        { error: "Please confirm your email before signing in.", code: "EMAIL_NOT_VERIFIED" },
        { status: 403 }
      );
    }

    const response = NextResponse.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isVerified: user.isVerified,
        location: user.location,
        phone: user.phone,
        bio: user.bio,
        avatar: user.avatar,
        createdAt: user.createdAt?.toISOString?.() || "",
        updatedAt: user.updatedAt?.toISOString?.() || "",
      },
    });
    setSessionCookie(request, response, user._id.toString());
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
