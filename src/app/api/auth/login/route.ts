import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { normalizeEmail } from "@/lib/authTokens";
import { toClientUser } from "@/lib/authUser";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { setSessionCookie } from "@/lib/session";
import User from "@/models/User";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    // Slow down password guessing: 10 tries per email and IP every 15 minutes.
    if (!rateLimit(`login:${clientIp(request)}:${email}`, 10, 15 * 60_000)) {
      return NextResponse.json(
        { error: "Too many sign-in attempts. Please wait a few minutes and try again." },
        { status: 429 }
      );
    }

    await connectToDatabase();
    const user = await User.findOne({ email }).lean();
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Only accounts created with verification on have emailVerified === false.
    if (user.emailVerified === false) {
      return NextResponse.json(
        { error: "Please confirm your email first. Check your inbox for the link.", code: "EMAIL_NOT_VERIFIED" },
        { status: 403 }
      );
    }

    const response = NextResponse.json({ user: toClientUser(user) });
    setSessionCookie(request, response, user._id.toString());
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
