import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import User from "@/models/User";

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    await connectToDatabase();
    const profile = await User.findById(user.id).select("-password +googleId").lean();
    if (!profile) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({
      user: {
        id: profile._id.toString(), email: profile.email, firstName: profile.firstName,
        lastName: profile.lastName, role: profile.role, isVerified: profile.isVerified,
        location: profile.location, phone: profile.phone, defaultAddress: profile.defaultAddress,
        authProvider: profile.authProvider || (profile.googleId ? "google" : "email"), bio: profile.bio, avatar: profile.avatar,
        lastActiveAt: profile.lastActiveAt?.toISOString?.() || null,
        createdAt: profile.createdAt?.toISOString?.() || "", updatedAt: profile.updatedAt?.toISOString?.() || "",
      },
    });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json({ error: "Could not check session" }, { status: 500 });
  }
}
