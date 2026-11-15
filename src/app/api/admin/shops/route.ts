import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import Shop from "@/models/Shop";
import Product from "@/models/Product";
import { invalidateCache } from "@/lib/cache";

function toStr(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null && "_id" in val) {
    return String((val as { _id: unknown })._id);
  }
  return String(val);
}

// GET — list shops with filters
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

    const status = searchParams.get("status"); // "pending" | "verified" | "rejected" | null (all)
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
      ];
    }

    const total = await Shop.countDocuments(query);
    const shops = await Shop.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Batch fetch owners
    const ownerIds = [...new Set(shops.map((s) => toStr(s.ownerId)).filter(Boolean))];
    const owners = ownerIds.length > 0
      ? await User.find({ _id: { $in: ownerIds } })
          .select("firstName lastName email avatar phone")
          .lean()
      : [];
    const ownerMap = new Map<string, Record<string, unknown>>();
    owners.forEach((o) => ownerMap.set(toStr(o._id), o as unknown as Record<string, unknown>));

    // Batch count products
    const shopIds = shops.map((s) => s._id);
    const productCounts = await Product.aggregate([
      { $match: { shopId: { $in: shopIds } } },
      { $group: { _id: "$shopId", count: { $sum: 1 } } },
    ]);
    const countMap = new Map<string, number>();
    productCounts.forEach((pc) => countMap.set(toStr(pc._id), pc.count));

    return NextResponse.json({
      shops: shops.map((shop) => {
        const owner = ownerMap.get(toStr(shop.ownerId));
        return {
          id: shop._id.toString(),
          name: shop.name,
          description: shop.description,
          ownerId: toStr(shop.ownerId),
          ownerName: owner ? `${owner.firstName} ${owner.lastName}` : "Unknown",
          ownerEmail: owner?.email || "",
          locationId: shop.locationId,
          status: shop.status,
          profileImage: shop.profileImage,
          coverImage: shop.coverImage,
          specialties: shop.specialties,
          rating: shop.rating,
          totalReviews: shop.totalReviews,
          productCount: countMap.get(shop._id.toString()) || 0,
          verificationDocuments: shop.verificationDocuments,
          verificationNotes: shop.verificationNotes,
          rejectedReason: shop.rejectedReason,
          verifiedAt: shop.verifiedAt,
          createdAt: shop.createdAt,
          updatedAt: shop.updatedAt,
        };
      }),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Admin shops GET error:", error);
    return NextResponse.json({ error: "Failed to fetch shops" }, { status: 500 });
  }
}

// PUT — verify or reject a shop
export async function PUT(request: NextRequest) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { userId, shopId, action, reason } = body;

    if (!userId || !shopId || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const adminUser = await User.findById(userId).select("role").lean();
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    if (action === "verify") {
      shop.status = "verified";
      shop.verifiedAt = new Date();
      shop.rejectedReason = undefined;
      await shop.save();

      // Invalidate caches
      invalidateCache("shops:");
      invalidateCache(`shop:${shopId}`);

      return NextResponse.json({ success: true, status: "verified" });
    }

    if (action === "reject") {
      shop.status = "rejected";
      shop.rejectedReason = reason || "Documents did not meet requirements";
      await shop.save();

      invalidateCache("shops:");
      invalidateCache(`shop:${shopId}`);

      return NextResponse.json({ success: true, status: "rejected" });
    }

    if (action === "updateDocuments") {
      shop.verificationDocuments = body.documents || shop.verificationDocuments;
      shop.verificationNotes = body.notes || shop.verificationNotes;
      await shop.save();

      invalidateCache("shops:");
      invalidateCache(`shop:${shopId}`);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Admin shops PUT error:", error);
    return NextResponse.json({ error: "Failed to update shop" }, { status: 500 });
  }
}
