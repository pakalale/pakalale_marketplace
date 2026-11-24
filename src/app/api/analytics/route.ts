import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Shop from "@/models/Shop";
import ShopView from "@/models/ShopView";
import Product from "@/models/Product";
import Order from "@/models/Order";
import { normalizeOrderStatus } from "@/lib/orderStatus";
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
    const existingShop = await Shop.findById(shopIdParam).select("_id").lean();
    if (existingShop) {
      shopObjectId = existingShop._id;
    } else {
      const shopByOwner = await Shop.findOne({ ownerId: shopIdParam }).select("_id").lean();
      if (shopByOwner) {
        shopObjectId = shopByOwner._id;
      } else {
        return NextResponse.json({ error: "Shop not found" }, { status: 404 });
      }
    }

    // Order stats drive sales figures; legacy statuses are normalised below.
    const [orderStats, recentOrderDocs] = await Promise.all([
      Order.aggregate([
        { $match: { shopId: shopObjectId } },
        { $group: {
          _id: "$status",
          count: { $sum: 1 },
          revenue: { $sum: {
            $cond: [{ $in: ["$status", ["completed", "received"]] }, "$total", 0]
          }}
        }}
      ]),
      // Only fetch 5 most recent for the UI
      Order.find({ shopId: shopObjectId })
        .select("customerId items status total createdAt")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    // Build stats from aggregation
    const orderStatusCounts: Record<string, number> = {};
    let totalRevenue = 0;
    let completedCount = 0;
    orderStats.forEach((s) => {
      const status = normalizeOrderStatus(s._id);
      orderStatusCounts[status] = (orderStatusCounts[status] || 0) + s.count;
      totalRevenue += s.revenue || 0;
      if (status === "completed") completedCount += s.count;
    });
    const totalOrders = orderStats.reduce((sum, s) => sum + s.count, 0);
    const avgOrderValue = completedCount > 0 ? Math.round(totalRevenue / completedCount) : 0;

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

    // Get customer names and product names for the recent orders
    const customerIds = [...new Set(
      recentOrderDocs.map((o) => toStr(o.customerId)).filter(Boolean)
    )];
    const orderedProductIds = [...new Set(
      recentOrderDocs.flatMap((o) => o.items.map((i) => toStr(i.productId))).filter(Boolean)
    )];
    const User = (await import("@/models/User")).default;
    const [customers, orderedProducts] = await Promise.all([
      customerIds.length > 0
        ? User.find({ _id: { $in: customerIds } })
            .select("firstName lastName")
            .lean()
        : [],
      orderedProductIds.length > 0
        ? Product.find({ _id: { $in: orderedProductIds } })
            .select("name")
            .lean()
        : [],
    ]);
    const customerMap = new Map<string, { firstName: string; lastName: string }>();
    customers.forEach((c) => customerMap.set(toStr(c._id), c as { firstName: string; lastName: string }));
    const orderedProductMap = new Map<string, string>();
    orderedProducts.forEach((p) => orderedProductMap.set(toStr(p._id), String(p.name || "")));

    const result = {
      stats: {
        totalProducts: productStats.totalProducts,
        totalViews: viewsCount,
        totalOrders,
        totalRevenue,
        avgOrderValue,
        conversionRate: parseFloat(conversionRate),
        totalStock: productStats.totalStock || 0,
        shopRating: shopData?.rating || 0,
        shopReviews: shopData?.totalReviews || 0,
        shopTotalViews,
        responseRate: shopData?.responseRate || 0,
        avgResponseTime: shopData?.avgResponseTime || 0,
      },
      ordersByStatus: orderStatusCounts,
      recentOrders: recentOrderDocs.map((order) => {
        const customer = customerMap.get(toStr(order.customerId));
        const customerName = customer ? `${customer.firstName} ${customer.lastName}` : "Customer";
        const productNames = order.items
          .map((item) => orderedProductMap.get(toStr(item.productId)) || "Product")
          .join(", ");

        return {
          id: order._id.toString(),
          customer: customerName,
          products: productNames || "Order",
          total: order.total || 0,
          status: normalizeOrderStatus(order.status),
          createdAt: order.createdAt,
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
