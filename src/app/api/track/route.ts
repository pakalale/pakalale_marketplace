import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import Product from "@/models/Product";
import Shop from "@/models/Shop";
import ShopView from "@/models/ShopView";
import { FeedPost } from "@/models/FeedPost";
import ProductView from "@/models/ProductView";
import FeedEvent from "@/models/FeedEvent";

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { type, targetId, userId, source } = body;

    if (!type || !targetId) {
      return NextResponse.json({ error: "type and targetId are required" }, { status: 400 });
    }

    switch (type) {
      case "product_view": {
        // Increment product view count
        await Product.findByIdAndUpdate(targetId, { $inc: { views: 1 } });
        // Record in ProductView collection for analytics
        if (userId) {
          await ProductView.create({
            productId: targetId,
            userId,
            source: source || "direct",
            timestamp: new Date(),
          });
        }
        break;
      }

      case "shop_view": {
        if (!mongoose.isValidObjectId(targetId)) break;
        const shop = await Shop.findById(targetId).select("_id").lean();
        if (!shop) break;

        const session = await getSessionUser(request);
        if (!session || !mongoose.isValidObjectId(session.id)) {
          break;
        }

        const filter = { shopId: shop._id, visitorId: new mongoose.Types.ObjectId(session.id) };
        let result;
        try {
          result = await ShopView.updateOne(
            filter,
            { $set: { lastViewedAt: new Date() } },
            { upsert: true }
          );
        } catch (error) {
          if ((error as { code?: number }).code !== 11000) throw error;
          await ShopView.updateOne(filter, { $set: { lastViewedAt: new Date() } });
        }
        if (result?.upsertedCount) {
          await Shop.findByIdAndUpdate(targetId, { $inc: { totalViews: 1 } });
        }
        break;
      }

      case "feed_view": {
        // Record feed post view for engagement tracking
        if (userId) {
          await FeedEvent.create({
            userId,
            postId: targetId,
            eventType: "view",
            timestamp: new Date(),
          });
        }
        break;
      }

      case "feed_click": {
        if (userId) {
          await FeedEvent.create({
            userId,
            postId: targetId,
            eventType: "click",
            metadata: body.metadata || {},
            timestamp: new Date(),
          });
        }
        break;
      }

      case "feed_share": {
        // Increment share count on the post
        await FeedPost.findByIdAndUpdate(targetId, { $inc: { shares: 1 } });
        if (userId) {
          await FeedEvent.create({
            userId,
            postId: targetId,
            eventType: "share",
            timestamp: new Date(),
          });
        }
        break;
      }

      case "feed_deal": {
        if (userId) {
          await FeedEvent.create({
            userId,
            postId: targetId,
            eventType: "deal",
            metadata: body.metadata || {},
            timestamp: new Date(),
          });
        }
        break;
      }

      default:
        return NextResponse.json({ error: "Invalid track type" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Track POST error:", error);
    return NextResponse.json({ success: true }); // Silent fail — tracking should never block UX
  }
}
