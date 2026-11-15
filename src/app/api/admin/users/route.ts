import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import Shop from "@/models/Shop";

function toStr(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null && "_id" in val) {
    return String((val as { _id: unknown })._id);
  }
  return String(val);
}

// GET — list users
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const adminUser = await User.findById(userId).select("role").lean();
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const role = searchParams.get("role");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const query: Record<string, unknown> = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("firstName lastName email role avatar isVerified location phone lastActiveAt createdAt")
      .lean();

    // For shop owners, get their shop name/status
    const shopOwners = users.filter((u) => u.role === "shop_owner");
    const ownerIds = shopOwners.map((u) => toStr(u._id));
    const shops = ownerIds.length > 0
      ? await Shop.find({ ownerId: { $in: ownerIds } })
          .select("ownerId name status")
          .lean()
      : [];
    const shopMap = new Map<string, { name: string; status: string }>();
    shops.forEach((s) => shopMap.set(toStr(s.ownerId), { name: s.name, status: s.status }));

    return NextResponse.json({
      users: users.map((u) => ({
        id: u._id.toString(),
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        avatar: u.avatar,
        isVerified: u.isVerified,
        location: u.location,
        phone: u.phone,
        lastActiveAt: u.lastActiveAt,
        shopName: shopMap.get(toStr(u._id))?.name,
        shopStatus: shopMap.get(toStr(u._id))?.status,
        createdAt: u.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Admin users GET error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

// PUT — update user (ban, change role, etc.)
export async function PUT(request: NextRequest) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { adminId, targetUserId, action, value } = body;

    if (!adminId || !targetUserId || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const adminUser = await User.findById(adminId).select("role").lean();
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Prevent self-modification
    if (adminId === targetUserId) {
      return NextResponse.json({ error: "Cannot modify your own account" }, { status: 400 });
    }

    if (action === "setRole") {
      const validRoles = ["customer", "shop_owner", "admin"];
      if (!validRoles.includes(value)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      await User.findByIdAndUpdate(targetUserId, { role: value });
      return NextResponse.json({ success: true });
    }

    if (action === "setVerified") {
      await User.findByIdAndUpdate(targetUserId, { isVerified: !!value });
      return NextResponse.json({ success: true });
    }

    if (action === "delete") {
      await User.findByIdAndDelete(targetUserId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Admin users PUT error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
