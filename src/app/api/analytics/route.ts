import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Shop from "@/models/Shop";
import ShopView from "@/models/ShopView";
import Product from "@/models/Product";
import { Chat, Message } from "@/models/Message";
import { getCached, setCache } from "@/lib/cache";

function toStr(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null && "_id" in val) {
    return String((val as { _id: unknown })._id);
  }
  return String(val);
}

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const shopIdParam = searchParams.get("shopId");

    if (!shopIdParam) {
      return NextResponse.json({ error: "shopId is required" }, { status: 400 });
    }

    const cacheKey = `analytics:v2:${shopIdParam}`;
    const cached = getCached(cacheKey);
    if (cached) return NextResponse.json(cached);

    // Resolve: if this is an ownerId (user ID), find the shop first
    let shopObjectId: mongoose.Types.ObjectId;
    let ownerId = shopIdParam;
    const existingShop = await Shop.findById(shopIdParam).select("_id ownerId").lean();
    if (existingShop) {
      shopObjectId = existingShop._id;
      ownerId = toStr(existingShop.ownerId);
    } else {
      const shopByOwner = await Shop.findOne({ ownerId: shopIdParam }).select("_id").lean();
      if (shopByOwner) {
        shopObjectId = shopByOwner._id;
      } else {
        return NextResponse.json({ error: "Shop not found" }, { status: 404 });
      }
    }

    // Use aggregation for deal stats instead of fetching all deals
    const [dealStats, recentDealChats] = await Promise.all([
      Chat.aggregate([
        { $match: { participants: new mongoose.Types.ObjectId(ownerId), type: "deal", "dealInfo.status": { $exists: true } } },
        { $group: {
          _id: "$dealInfo.status",
          count: { $sum: 1 },
          revenue: { $sum: {
            $cond: [{ $eq: ["$dealInfo.status", "completed"] },
              { $ifNull: ["$dealInfo.counterPrice", "$dealInfo.initialPrice", 0] }, 0]
          }}
        }}
      ]),
      // Only fetch 5 most recent for the UI
      Chat.find({ participants: ownerId, type: "deal", "dealInfo.status": { $exists: true } })
        .select("type participants dealInfo lastMessageTime createdAt")
        .sort({ lastMessageTime: -1 })
        .limit(5)
        .lean(),
    ]);

    // Build stats from aggregation
    const dealStatusCounts: Record<string, number> = {};
    let totalRevenue = 0;
    let completedCount = 0;
    dealStats.forEach((s) => {
      dealStatusCounts[s._id] = s.count;
      totalRevenue += s.revenue || 0;
      if (s._id === "completed") completedCount = s.count;
    });
    const totalDeals = dealStats.reduce((sum, s) => sum + s.count, 0);
    const activeCount = (dealStatusCounts["pending"] || 0) + (dealStatusCounts["negotiating"] || 0) + (dealStatusCounts["confirmed"] || 0);
    const avgDealValue = completedCount > 0 ? Math.round(totalRevenue / completedCount) : 0;

    // Single aggregation for all product stats + shop data
    const [productAgg, topProducts] = await Promise.all([
      Product.aggregate([
        { $match: { shopId: shopObjectId } },
        { $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalViews: { $sum: "$views" },
          totalStock: { $sum: "$stock" },
        }},
      ]),
      Product.find({ shopId: shopObjectId })
        .sort({ views: -1 })
        .limit(5)
        .select("name price views stock rating reviews")
        .lean(),
    ]);

    const productStats = productAgg[0] || { totalProducts: 0, totalViews: 0, totalStock: 0 };
    const viewsCount = productStats.totalViews || 0;
    const conversionRate = viewsCount > 0 ? ((completedCount / viewsCount) * 100).toFixed(1) : "0";

    // Get shop data in same query batch
    const [shopData, shopTotalViews] = await Promise.all([
      Shop.findById(shopObjectId)
        .select("rating totalReviews responseRate avgResponseTime")
        .lean(),
      ShopView.countDocuments({ shopId: shopObjectId }),
    ]);

    // Get customer names for recent deals
    const participantIds = [...new Set(
      recentDealChats.flatMap((c) => c.participants.map((p) => toStr(p))).filter((p) => p !== ownerId)
    )];
    const User = (await import("@/models/User")).default;
    const customers = participantIds.length > 0
      ? await User.find({ _id: { $in: participantIds } })
          .select("firstName lastName")
          .lean()
      : [];
    const customerMap = new Map<string, { firstName: string; lastName: string }>();
    customers.forEach((c) => customerMap.set(toStr(c._id), c as { firstName: string; lastName: string }));

    const result = {
      stats: {
        totalProducts: productStats.totalProducts,
        totalViews: viewsCount,
        totalOrders: totalDeals,
        totalRevenue,
        avgOrderValue: avgDealValue,
        conversionRate: parseFloat(conversionRate),
        totalStock: productStats.totalStock || 0,
        shopRating: shopData?.rating || 0,
        shopReviews: shopData?.totalReviews || 0,
        shopTotalViews,
        responseRate: shopData?.responseRate || 0,
        avgResponseTime: shopData?.avgResponseTime || 0,
      },
      ordersByStatus: dealStatusCounts,
      recentOrders: recentDealChats.map((chat) => {
        const otherParticipant = chat.participants
          .map((p) => toStr(p))
          .find((p) => p !== ownerId);
        const customer = otherParticipant ? customerMap.get(otherParticipant) : null;
        const customerName = customer ? `${customer.firstName} ${customer.lastName}` : "Customer";
        const price = chat.dealInfo?.counterPrice || chat.dealInfo?.initialPrice || 0;

        return {
          id: chat._id.toString(),
          customer: customerName,
          products: chat.dealInfo?.productName || "Deal",
          total: price,
          status: chat.dealInfo?.status || "pending",
          createdAt: chat.createdAt,
        };
      }),
      topProducts: topProducts.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        price: p.price,
        views: p.views,
        stock: p.stock,
        rating: p.rating,
        reviews: p.reviews,
      })),
    };
    setCache(cacheKey, result, 60_000);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Analytics GET error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
