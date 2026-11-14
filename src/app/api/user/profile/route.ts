import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getSessionUser, requireSession } from "@/lib/session";
import User from "@/models/User";
import { getCached, setCache, invalidateCache } from "@/lib/cache";

type ProfileResult = { user: { email?: string; phone?: string; role: string } & Record<string, unknown> };

/**
 * Profiles are public, but a person's email and phone are only for them and
 * admins. A shop owner's phone stays visible because customers call shops.
 */
async function visibleProfile(request: NextRequest, userId: string, result: ProfileResult) {
  const viewer = await getSessionUser(request);
  if (viewer && (viewer.id === userId || viewer.role === "admin")) return result;
  return {
    user: {
      ...result.user,
      email: undefined,
      phone: result.user.role === "shop_owner" ? result.user.phone : undefined,
    },
  };
}

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
    if (cached) return NextResponse.json(await visibleProfile(request, userId, cached as ProfileResult));

    const user = await User.findById(userId)
      .select("-password")
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
        bio: user.bio,
        lastActiveAt: user.lastActiveAt?.toISOString?.() || null,
        createdAt: user.createdAt?.toISOString?.() || "",
        updatedAt: user.updatedAt?.toISOString?.() || "",
      },
    };
    setCache(cacheKey, result, 30_000); // 30s cache
    return NextResponse.json(await visibleProfile(request, userId, result));
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
    const auth = await requireSession(request, { actingAs: userId });
    if (auth.response) return auth.response;

    // Only allow updating certain fields
    const allowedFields = ["firstName", "lastName", "phone", "location", "bio", "avatar", "lastActiveAt"];
    const safeUpdate: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        safeUpdate[field] = updateData[field];
      }
    }

    const user = await User.findByIdAndUpdate(userId, safeUpdate, { new: true })
      .select("-password")
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
