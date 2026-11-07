import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { FeedPost } from "@/models/FeedPost";
import User from "@/models/User";
import Shop from "@/models/Shop";
import { getCached, setCache, invalidateCache } from "@/lib/cache";

function toStr(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (val instanceof mongoose.Types.ObjectId) return val.toString();
  if (typeof val === "object" && val !== null && "_id" in val) {
    return String((val as { _id: unknown })._id);
  }
  return String(val);
}

function computeRankScore(post: Record<string, unknown>): number {
  const now = Date.now();
  const created = new Date(post.createdAt as string).getTime();
  const ageHours = Math.max(1, (now - created) / (1000 * 60 * 60));

  const likes = (post.likes as unknown[])?.length || 0;
  const comments = (post.comments as unknown[])?.length || 0;
  const shares = (post.shares as number) || 0;
  const images = (post.images as unknown[])?.length || 0;

  // Engagement score: weighted sum of interactions
  const engagement = likes * 1 + comments * 2 + shares * 3 + images * 0.5;

  // Recency decay: half-life of 6 hours (Facebook-style)
  const recency = Math.pow(0.5, ageHours / 6);

  // Content quality signals
  const hasImages = images > 0 ? 1.2 : 1;
  const isPromotion = post.isPromotion ? 1.3 : 1;

  // Final score: engagement scaled by recency, boosted by content type
  return (engagement + 1) * recency * hasImages * isPromotion;
}

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);

    const query: Record<string, unknown> = {};

    const filter = searchParams.get("filter");
    if (filter === "promotions") {
      query.isPromotion = true;
    }

    const locationId = searchParams.get("locationId");
    if (locationId) query.locationId = locationId;

    const authorId = searchParams.get("authorId");
    if (authorId) query.authorId = authorId;

    // Cursor-based pagination: cursor is the ISO date of the last post
    const cursor = searchParams.get("cursor");
    const limit = parseInt(searchParams.get("limit") || "20");
    const mode = searchParams.get("mode") || "ranked"; // ranked | chronological

    if (cursor) {
      const cursorDate = new Date(cursor);
      query.createdAt = { $lt: cursorDate };
    }

    const cacheKey = `feed:${JSON.stringify({ filter, locationId, authorId, cursor, limit, mode })}`;
    const cached = getCached(cacheKey);
    if (cached) return NextResponse.json(cached);

    // For ranked mode, fetch a larger pool to score and rank
    const fetchLimit = mode === "ranked" ? Math.min(limit * 3, 60) : limit;

    let posts: (Record<string, unknown> & { _rankScore?: number; _likesCount?: number; _commentsCount?: number })[] = await FeedPost.find(query)
      .sort({ createdAt: -1 })
      .limit(fetchLimit)
      .select("content images authorId locationId shares isPromotion product postType relatedProductId relatedShopId createdAt updatedAt")
      .lean() as unknown as (Record<string, unknown> & { _rankScore?: number })[];

    // Get likes and comments counts via aggregation (avoids transferring full arrays)
    const postIds = posts.map((p) => p._id);
    const countsAgg = postIds.length > 0 ? await FeedPost.aggregate([
      { $match: { _id: { $in: postIds } } },
      { $project: {
        likesCount: { $size: { $ifNull: ["$likes", []] } },
        commentsCount: { $size: { $ifNull: ["$comments", []] } },
      }},
    ]) : [];
    const countsMap = new Map<string, { likesCount: number; commentsCount: number }>();
    countsAgg.forEach((c) => countsMap.set(c._id.toString(), { likesCount: c.likesCount, commentsCount: c.commentsCount }));
    posts.forEach((p) => {
      const counts = countsMap.get(String(p._id));
      p._likesCount = counts?.likesCount || 0;
      p._commentsCount = counts?.commentsCount || 0;
    });

    // For ranked mode: compute scores, sort by score, take top N
    if (mode === "ranked" && posts.length > 0) {
      posts = posts
        .map((p) => ({ ...p, _rankScore: computeRankScore(p) }))
        .sort((a, b) => (b._rankScore || 0) - (a._rankScore || 0))
        .slice(0, limit);
    }

    const total = await FeedPost.countDocuments(query);

    if (posts.length === 0) {
      const result = { posts: [], total, cursor: null, hasMore: false };
      setCache(cacheKey, result, 30_000);
      return NextResponse.json(result);
    }

    // Batch fetch authors and shops in parallel
    const authorIds = [...new Set(posts.map((p) => toStr(p.authorId)).filter(Boolean))];
    const [authors, shops] = await Promise.all([
      authorIds.length > 0
        ? (await import("@/models/User")).default
            .find({ _id: { $in: authorIds } })
            .select("firstName lastName avatar role")
            .lean()
        : [],
      authorIds.length > 0
        ? Shop.find({ ownerId: { $in: authorIds } })
            .select("ownerId name profileImage locationId status")
            .lean()
        : [],
    ]);

    const authorMap = new Map<string, Record<string, unknown>>();
    authors.forEach((a) => authorMap.set(toStr(a._id), a as unknown as Record<string, unknown>));

    const shopByOwner = new Map<string, { shopId: string; shopName: string; shopAvatar: string; locationId: string; status: string }>();
    shops.forEach((s) => {
      shopByOwner.set(toStr(s.ownerId), {
        shopId: toStr(s._id),
        shopName: String(s.name || ""),
        shopAvatar: String(s.profileImage || ""),
        locationId: toStr(s.locationId),
        status: String(s.status),
      });
    });

    const mappedPosts = posts.map((p: Record<string, unknown>) => {
        const authorObj = authorMap.get(toStr(p.authorId));
        const hasAuthor = !!authorObj;
        const ownerShop =
          hasAuthor && authorObj!.role === "shop_owner"
            ? shopByOwner.get(toStr(p.authorId))
            : undefined;
        const images = (p.images as unknown[]) || [];
        const product = p.product as Record<string, unknown> | undefined;

        // For shop owners, use shop name/avatar instead of personal name/avatar
        const isShopOwner = hasAuthor && authorObj!.role === "shop_owner";
        const shopData = isShopOwner && ownerShop ? shopByOwner.get(toStr(p.authorId)) : null;

        return {
          id: String(p._id),
          content: (() => { const c = String(p.content || ""); return c.length > 500 ? c.slice(0, 500) + "..." : c; })(),
          images,
          authorId: toStr(p.authorId),
          author: hasAuthor
            ? {
                id: toStr(p.authorId),
                name: shopData?.shopName || `${authorObj.firstName} ${authorObj.lastName}`,
                avatar: shopData?.shopAvatar || authorObj.avatar,
                role: authorObj.role,
                shopId: ownerShop?.shopId || null,
                shopLocationId: ownerShop?.locationId || null,
                isShopVerified: ownerShop?.status === "verified",
              }
            : null,
          locationId: p.locationId,
          likes: p._likesCount || 0,
          likedBy: [],
          comments: [],
          commentsCount: p._commentsCount || 0,
          shares: p.shares,
          isPromotion: p.isPromotion,
          postType: p.postType || "general",
          product: product
            ? { ...product, id: toStr(p.relatedProductId), shopId: toStr(product.shopId) }
            : undefined,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        };
      });

    // Cursor = createdAt of the last post for next page
    const lastPost = mappedPosts[mappedPosts.length - 1];
    const nextCursor = lastPost ? lastPost.createdAt : null;
    const hasMore = mappedPosts.length === limit;

    const result = {
      posts: mappedPosts,
      total,
      cursor: nextCursor,
      hasMore,
    };
    setCache(cacheKey, result, 30_000);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Feed GET error:", error);
    return NextResponse.json({ error: "Failed to fetch feed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const post = await FeedPost.create(body);
    invalidateCache("feed:");
    return NextResponse.json(
      {
        post: { ...post.toObject(), id: post._id.toString(), likes: 0, comments: [] },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Feed POST error:", error);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { id, action, userId, comment } = body;

    if (!id) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
    }

    if (action === "like") {
      const userIdObj = new mongoose.Types.ObjectId(userId);
      const alreadyLiked = await FeedPost.findOne({
        _id: id,
        likes: userIdObj,
      })
      .select("_id")
      .lean();

      if (alreadyLiked) {
        await FeedPost.findByIdAndUpdate(id, { $pull: { likes: userIdObj } });
        const post = await FeedPost.findById(id).select("likes").lean();
        invalidateCache("feed:");
        return NextResponse.json({
          liked: false,
          likesCount: post?.likes?.length || 0,
        });
      } else {
        // Fetch user's name for notification
        const userDoc = await User.findById(userId).select("firstName lastName").lean();
        const userName = userDoc ? `${userDoc.firstName} ${userDoc.lastName}`.trim() || "a user" : "a user";

        await FeedPost.findByIdAndUpdate(id, { $push: { likes: userIdObj } });
        const post = await FeedPost.findById(id).select("likes authorId").lean();
        invalidateCache("feed:");

        // Notify post author (not self)
        if (post && toStr(post.authorId) !== userId) {
          const { createNotification } = await import("@/lib/notifications");
          await createNotification({
            userId: toStr(post.authorId),
            type: "review",
            title: `Your post was liked by ${userName} ❤️`,
            message: `Your post was liked by a user.`,
            actionUrl: "/customer/profile/${userId}",
            relatedId: userId,
          });
        }

        return NextResponse.json({
          liked: true,
          likesCount: post?.likes?.length || 0,
        });
      }
    }

    if (action === "comment") {
      await FeedPost.findByIdAndUpdate(id, {
        $push: {
          comments: {
            authorId: new mongoose.Types.ObjectId(userId),
            authorName: comment.authorName,
            content: comment.content,
            createdAt: new Date(),
          },
        },
      });
      const post = await FeedPost.findById(id).select("comments authorId").lean();
      invalidateCache("feed:");

      // Notify post author (not self)
      if (post && toStr(post.authorId) !== userId) {
        const { createNotification } = await import("@/lib/notifications");
        await createNotification({
          userId: toStr(post.authorId),
          type: "message",
          title: `New comment by ${comment.authorName}`,
          message: comment.content.length > 80 ? comment.content.slice(0, 80) + "..." : comment.content,
          actionUrl: "/customer",
        });
      }

      return NextResponse.json({
        commentsCount: post?.comments?.length || 0,
        comment: post?.comments?.[post.comments.length - 1] || null,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Feed PUT error:", error);
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}
