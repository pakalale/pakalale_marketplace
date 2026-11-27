import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { FeedPost, type IFeedComment } from "@/models/FeedPost";
import User from "@/models/User";
import Shop from "@/models/Shop";

type Person = {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  isShopVerified?: boolean;
};

type LeanUser = {
  _id: mongoose.Types.ObjectId;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  role?: string;
};

function toStr(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (val instanceof mongoose.Types.ObjectId) return val.toString();
  if (typeof val === "object" && val !== null && "_id" in val) {
    return String((val as { _id: unknown })._id);
  }
  return String(val);
}

/** Names and avatars for everyone involved in a post (author, commenters, likers, sharers). */
async function buildPeople(ids: string[]): Promise<Map<string, Person>> {
  const uniqueIds = [...new Set(ids.filter((id) => mongoose.isValidObjectId(id)))];
  const people = new Map<string, Person>();
  if (uniqueIds.length === 0) return people;

  const users = (await User.find({ _id: { $in: uniqueIds } })
    .select("firstName lastName avatar role")
    .lean()) as unknown as LeanUser[];

  const shopOwnerIds = users.filter((user) => user.role === "shop_owner").map((user) => toStr(user._id));
  const shops = shopOwnerIds.length > 0
    ? await Shop.find({ ownerId: { $in: shopOwnerIds } })
        .select("ownerId name profileImage status")
        .lean()
    : [];

  const shopByOwner = new Map<string, { name: string; avatar?: string; isVerified: boolean }>();
  shops.forEach((shop) => {
    shopByOwner.set(toStr(shop.ownerId), {
      name: String(shop.name || ""),
      avatar: shop.profileImage || undefined,
      isVerified: shop.status === "verified",
    });
  });

  users.forEach((user) => {
    const id = toStr(user._id);
    const shop = shopByOwner.get(id);
    const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    people.set(id, {
      id,
      name: shop?.name || fullName || "Pakalale user",
      avatar: shop?.avatar || user.avatar || undefined,
      role: user.role || "customer",
      isShopVerified: shop?.isVerified || false,
    });
  });

  return people;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    await connectToDatabase();
    const { postId } = await params;

    if (!mongoose.isValidObjectId(postId)) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const post = await FeedPost.findById(postId).lean();
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const comments = (post.comments || []) as IFeedComment[];
    const likeIds = (post.likes || []).map(toStr);
    const shareIds = (post.sharedBy || []).map(toStr);
    const commentAuthorIds = comments.map((comment) => toStr(comment.authorId));

    const people = await buildPeople([toStr(post.authorId), ...likeIds, ...shareIds, ...commentAuthorIds]);
    const author = people.get(toStr(post.authorId));

    return NextResponse.json({
      post: {
        id: toStr(post._id),
        content: post.content,
        images: post.images || [],
        authorId: toStr(post.authorId),
        author: author
          ? {
              id: author.id,
              name: author.name,
              avatar: author.avatar,
              role: author.role,
              isShopVerified: author.isShopVerified,
            }
          : null,
        locationId: post.locationId,
        likes: likeIds.length,
        likedBy: likeIds,
        likers: likeIds.map((id) => people.get(id)).filter(Boolean),
        shares: post.shares || 0,
        sharedBy: shareIds.map((id) => people.get(id)).filter(Boolean),
        comments: comments.map((comment) => {
          const person = people.get(toStr(comment.authorId));
          return {
            id: toStr(comment._id),
            authorId: toStr(comment.authorId),
            authorName: person?.name || comment.authorName || "Pakalale user",
            authorAvatar: person?.avatar,
            content: comment.content,
            createdAt: comment.createdAt,
            parentId: comment.parentId ? toStr(comment.parentId) : null,
            likes: (comment.likes || []).map(toStr),
            dislikes: (comment.dislikes || []).map(toStr),
          };
        }),
        commentsCount: comments.length,
        isPromotion: post.isPromotion,
        postType: post.postType || "general",
        product: post.product
          ? { ...post.product, id: toStr(post.relatedProductId), shopId: toStr(post.product.shopId) }
          : undefined,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      },
    });
  } catch (error) {
    console.error("Feed post GET error:", error);
    return NextResponse.json({ error: "Failed to load post" }, { status: 500 });
  }
}
