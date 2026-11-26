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

/** Shape of a completed order as returned by the sales aggregation. */
interface SaleDoc {
  _id: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  items: Array<{ productId: mongoose.Types.ObjectId; quantity: number; price: number }>;
  total: number;
  createdAt: Date;
}

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const shopIdParam = searchParams.get("shopId");

    if (!shopIdParam) {
      return NextResponse.json({ error: "shopId is required" }, { status: 400 });
    }

    const cacheKey = `analytics:v4:${shopIdParam}`;
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

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Order stats drive sales figures; legacy statuses are normalised below.
    const [orderStats, recentOrderDocs, recentSaleDocs, salesWindowAgg] = await Promise.all([
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
      // Completed orders are sales: what was bought, for how much, when and by whom.
      // Aggregated because the legacy "received" status is not in the model's enum type.
      Order.aggregate([
        { $match: { shopId: shopObjectId, status: { $in: ["completed", "received"] } } },
        { $sort: { createdAt: -1 } },
        { $limit: 10 },
        { $project: { customerId: 1, items: 1, total: 1, createdAt: 1 } },
      ]),
      // Today and last-7-days takings, counted from when the order was placed.
      Order.aggregate([
        { $match: { shopId: shopObjectId, status: { $in: ["completed", "received"] } } },
        {
          $group: {
            _id: null,
            todayCount: { $sum: { $cond: [{ $gte: ["$createdAt", startOfToday] }, 1, 0] } },
            todayRevenue: { $sum: { $cond: [{ $gte: ["$createdAt", startOfToday] }, "$total", 0] } },
            weekCount: { $sum: { $cond: [{ $gte: ["$createdAt", weekAgo] }, 1, 0] } },
            weekRevenue: { $sum: { $cond: [{ $gte: ["$createdAt", weekAgo] }, "$total", 0] } },
          },
        },
      ]),
    ]);

    // Aggregations come back untyped; name the sales shape once here.
    const saleDocs = recentSaleDocs as SaleDoc[];

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
    const [productAgg, topProducts, topSelling] = await Promise.all([
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
      // Units sold come from the counters updated when an order completes.
      Product.find({ shopId: shopObjectId, soldCount: { $gt: 0 } })
        .sort({ soldCount: -1 })
        .limit(5)
        .select("name price soldCount")
        .lean(),
    ]);

    const productStats = productAgg[0] || { totalProducts: 0, totalViews: 0, totalStock: 0 };
    const viewsCount = productStats.totalViews || 0;
    const conversionRate = viewsCount > 0 ? ((completedCount / viewsCount) * 100).toFixed(1) : "0";

    // Charts need real series, not counts: six months of takings, category mix
    // and the customer book (who buys, who comes back, who is new).
    const chartMatch = {
      shopId: shopObjectId,
      status: { $in: ["completed", "received"] },
    };
    const firstOfSixMonths = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [monthlyAgg, customerAgg, categoryAgg] = await Promise.all([
      Order.aggregate([
        { $match: { ...chartMatch, createdAt: { $gte: firstOfSixMonths } } },
        {
          $group: {
            _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
            revenue: { $sum: "$total" },
            count: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        { $match: chartMatch },
        {
          $group: {
            _id: "$customerId",
            orders: { $sum: 1 },
            spent: { $sum: "$total" },
            firstAt: { $min: "$createdAt" },
          },
        },
      ]),
      Order.aggregate([
        { $match: chartMatch },
        { $unwind: "$items" },
        {
          $lookup: {
            from: Product.collection.name,
            localField: "items.productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ["$product.category", "Other"] },
            revenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
            units: { $sum: "$items.quantity" },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 6 },
      ]),
    ]);

    // Fill the months with no sales so the chart keeps an even baseline.
    const salesTrend = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      return {
        month: `${date.getFullYear()}-${date.getMonth() + 1}`,
        label: date.toLocaleDateString("en-GB", { month: "short" }),
        revenue: 0,
        count: 0,
      };
    });
    (
      monthlyAgg as Array<{ _id: { year: number; month: number }; revenue: number; count: number }>
    ).forEach((row) => {
      const bucket = salesTrend.find(
        (month) => month.month === `${row._id.year}-${row._id.month}`
      );
      if (bucket) {
        bucket.revenue = row.revenue || 0;
        bucket.count = row.count || 0;
      }
    });

    const customerRows = customerAgg as Array<{
      _id: unknown;
      orders: number;
      spent: number;
      firstAt: Date;
    }>;
    const customerBook = {
      total: customerRows.length,
      repeat: customerRows.filter((row) => row.orders > 1).length,
      newThisMonth: customerRows.filter((row) => new Date(row.firstAt) >= startOfMonth).length,
      avgSpend:
        customerRows.length > 0 ? Math.round(totalRevenue / customerRows.length) : 0,
    };

    const salesByCategory = (
      categoryAgg as Array<{ _id: string; revenue: number; units: number }>
    ).map((row) => ({
      category: row._id || "Other",
      revenue: Math.round(row.revenue || 0),
      units: row.units || 0,
    }));

    // Get shop data in same query batch
    const [shopData, shopTotalViews] = await Promise.all([
      Shop.findById(shopObjectId)
        .select("rating totalReviews responseRate avgResponseTime")
        .lean(),
      ShopView.countDocuments({ shopId: shopObjectId }),
    ]);

    // Get customer names and product names for the recent orders and sales
    const namedOrders = [...recentOrderDocs, ...saleDocs];
    const customerIds = [...new Set(
      namedOrders.map((o) => toStr(o.customerId)).filter(Boolean)
    )];
    const orderedProductIds = [...new Set(
      namedOrders.flatMap((o) => o.items.map((i) => toStr(i.productId))).filter(Boolean)
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
      recentSales: saleDocs.map((order) => {
        const customer = customerMap.get(toStr(order.customerId));
        const items = order.items.map((item) => ({
          name: orderedProductMap.get(toStr(item.productId)) || "Product",
          quantity: item.quantity,
          price: item.price,
        }));
        return {
          id: order._id.toString(),
          customer: customer ? `${customer.firstName} ${customer.lastName}` : "Customer",
          items,
          units: items.reduce((sum, item) => sum + item.quantity, 0),
          total: order.total || 0,
          createdAt: order.createdAt,
        };
      }),
      salesSummary: {
        today: {
          count: salesWindowAgg[0]?.todayCount || 0,
          revenue: salesWindowAgg[0]?.todayRevenue || 0,
        },
        week: {
          count: salesWindowAgg[0]?.weekCount || 0,
          revenue: salesWindowAgg[0]?.weekRevenue || 0,
        },
      },
      topSellingProducts: topSelling.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        sold: p.soldCount || 0,
        price: p.price,
      })),
      salesTrend,
      salesByCategory,
      customers: customerBook,
    };
    setCache(cacheKey, result, 60_000);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Analytics GET error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
