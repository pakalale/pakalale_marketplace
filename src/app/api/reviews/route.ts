import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Review from "@/models/Review";
import Shop from "@/models/Shop";
import Product from "@/models/Product";
import { Chat } from "@/models/Message";
import { invalidateCache } from "@/lib/cache";
import { createNotification } from "@/lib/notifications";

function toStr(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (val instanceof mongoose.Types.ObjectId) return val.toString();
  if (typeof val === "object" && val !== null && "_id" in val) {
    return String((val as { _id: unknown })._id);
  }
  return String(val);
}

// GET: Fetch reviews for a shop or product
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);

    const shopId = searchParams.get("shopId");
    const productId = searchParams.get("productId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (shopId) query.shopId = shopId;
    if (productId) query.productId = productId;

    const [reviews, total] = await Promise.all([
      Review.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments(query),
    ]);

    // Fetch customer names
    const customerIds = [...new Set(reviews.map((r) => toStr(r.customerId)).filter(Boolean))];
    const User = (await import("@/models/User")).default;
    const customers = customerIds.length > 0
      ? await User.find({ _id: { $in: customerIds } })
          .select("firstName lastName avatar")
          .lean()
      : [];
    const customerMap = new Map<string, { firstName: string; lastName: string; avatar?: string }>();
    customers.forEach((c) => customerMap.set(toStr(c._id), c as { firstName: string; lastName: string; avatar?: string }));

    // Calculate average rating
    const allReviews = shopId
      ? await Review.find({ shopId }).select("rating").lean()
      : [];
    const avgRating = allReviews.length > 0
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
      : 0;

    return NextResponse.json({
      reviews: reviews.map((r) => {
        const customer = customerMap.get(toStr(r.customerId));
        return {
          id: r._id.toString(),
          customerId: toStr(r.customerId),
          customerName: customer ? `${customer.firstName} ${customer.lastName}` : "Customer",
          customerAvatar: customer?.avatar,
          shopId: toStr(r.shopId),
          productId: r.productId ? toStr(r.productId) : null,
          dealId: toStr(r.dealId),
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
        };
      }),
      total,
      avgRating: Math.round(avgRating * 10) / 10,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Reviews GET error:", error);
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}

// POST: Submit a review after deal completion
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { customerId, shopId, productId, dealId, rating, comment } = body;

    if (!customerId || !shopId || !dealId || !rating) {
      return NextResponse.json(
        { error: "customerId, shopId, dealId, and rating are required" },
        { status: 400 }
      );
    }

    // Verify the deal exists and is completed
    const deal = await Chat.findById(dealId).lean();
    if (!deal || deal.dealInfo?.status !== "completed") {
      return NextResponse.json(
        { error: "Can only review completed deals" },
        { status: 400 }
      );
    }

    // Check for existing review
    const existing = await Review.findOne({ dealId }).lean();
    if (existing) {
      return NextResponse.json(
        { error: "You have already reviewed this deal" },
        { status: 409 }
      );
    }

    // Create the review
    const review = await Review.create({
      customerId: new mongoose.Types.ObjectId(customerId),
      shopId: new mongoose.Types.ObjectId(shopId),
      productId: productId ? new mongoose.Types.ObjectId(productId) : undefined,
      dealId: new mongoose.Types.ObjectId(dealId),
      rating: Math.min(5, Math.max(1, rating)),
      comment: comment || "",
    });

    // Update shop's totalReviews and recalculate average rating
    const allShopReviews = await Review.find({
      shopId: new mongoose.Types.ObjectId(shopId),
    })
      .select("rating")
      .lean();

    const avgRating =
      allShopReviews.length > 0
        ? allShopReviews.reduce((sum, r) => sum + r.rating, 0) / allShopReviews.length
        : 0;

    await Shop.findByIdAndUpdate(shopId, {
      totalReviews: allShopReviews.length,
      rating: Math.round(avgRating * 10) / 10,
    });

    // Update product rating if productId provided
    if (productId) {
      const productReviews = await Review.find({
        productId: new mongoose.Types.ObjectId(productId),
      })
        .select("rating")
        .lean();

      const productAvg =
        productReviews.length > 0
          ? productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length
          : 5;

      await Product.findByIdAndUpdate(productId, {
        rating: Math.round(productAvg * 10) / 10,
        reviews: productReviews.length,
      });
    }

    // Notify shop owner about the review
    const shop = await Shop.findById(shopId).select("ownerId name").lean();
    if (shop) {
      await createNotification({
        userId: toStr(shop.ownerId),
        type: "review",
        title: "New review on your shop ⭐",
        message: `${rating}/5 stars${comment ? ': "' + comment.slice(0, 60) + '"' : ""}`,
        actionUrl: "/shop/feed",
      });
    }

    invalidateCache("shops:");
    invalidateCache("products:");

    return NextResponse.json({
      review: {
        id: review._id.toString(),
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Reviews POST error:", error);
    if ((error as Record<string, unknown>).code === 11000) {
      return NextResponse.json({ error: "You have already reviewed this deal" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
  }
}
