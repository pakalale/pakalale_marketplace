import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import Shop from "@/models/Shop";
import Product from "@/models/Product";
import { Chat, Message } from "@/models/Message";

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

    const [
      totalUsers,
      totalShops,
      totalProducts,
      totalChats,
      totalMessages,
      pendingShops,
      verifiedShops,
      rejectedShops,
      usersByRole,
      recentUsers,
      recentShops,
    ] = await Promise.all([
      User.countDocuments(),
      Shop.countDocuments(),
      Product.countDocuments(),
      Chat.countDocuments({ isActive: true }),
      Message.countDocuments(),
      Shop.countDocuments({ status: "pending" }),
      Shop.countDocuments({ status: "verified" }),
      Shop.countDocuments({ status: "rejected" }),
      User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
      User.find().sort({ createdAt: -1 }).limit(5)
        .select("firstName lastName email role createdAt").lean(),
      Shop.find().sort({ createdAt: -1 }).limit(5)
        .select("name status ownerId createdAt").lean(),
    ]);

    const roleMap: Record<string, number> = {};
    usersByRole.forEach((r: { _id: string; count: number }) => {
      roleMap[r._id] = r.count;
    });

    return NextResponse.json({
      totalUsers,
      totalShops,
      totalProducts,
      totalChats,
      totalMessages,
      pendingShops,
      verifiedShops,
      rejectedShops,
      customers: roleMap.customer || 0,
      shopOwners: roleMap.shop_owner || 0,
      admins: roleMap.admin || 0,
      recentUsers: recentUsers.map((u) => ({
        id: u._id.toString(),
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
      })),
      recentShops: recentShops.map((s) => ({
        id: s._id.toString(),
        name: s.name,
        status: s.status,
        ownerId: s.ownerId.toString(),
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
