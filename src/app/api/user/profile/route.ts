import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import { getCached, setCache, invalidateCache } from "@/lib/cache";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const cacheKey = `profile:${userId}`;
    const cached = getCached(cacheKey);
    if (cached) return NextResponse.json(cached);

    const user = await User.findById(userId)
      .select("-password +googleId")
      .lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const result = {
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        role: user.role,
        isVerified: user.isVerified,
        location: user.location,
        phone: user.phone,
        defaultAddress: user.defaultAddress,
        authProvider: user.authProvider || (user.googleId ? "google" : "email"),
        bio: user.bio,
        lastActiveAt: user.lastActiveAt?.toISOString?.() || null,
        createdAt: user.createdAt?.toISOString?.() || "",
        updatedAt: user.updatedAt?.toISOString?.() || "",
      },
    };
    setCache(cacheKey, result, 30_000); // 30s cache
    return NextResponse.json(result);
  } catch (error) {
    console.error("Profile GET error:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { userId, ...updateData } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Only allow updating certain fields
    const allowedFields = ["firstName", "lastName", "phone", "location", "defaultAddress", "bio", "avatar", "lastActiveAt"];
    const safeUpdate: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        safeUpdate[field] = updateData[field];
      }
    }

    const user = await User.findByIdAndUpdate(userId, safeUpdate, { new: true })
      .select("-password +googleId")
      .lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    invalidateCache(`profile:${userId}`);
    return NextResponse.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        role: user.role,
        isVerified: user.isVerified,
        location: user.location,
        phone: user.phone,
        defaultAddress: user.defaultAddress,
        authProvider: user.authProvider || (user.googleId ? "google" : "email"),
        bio: user.bio,
        lastActiveAt: user.lastActiveAt?.toISOString?.() || null,
        createdAt: user.createdAt?.toISOString?.() || "",
        updatedAt: user.updatedAt?.toISOString?.() || "",
      },
    });
  } catch (error) {
    console.error("Profile PUT error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
