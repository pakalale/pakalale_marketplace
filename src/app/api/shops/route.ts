import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Shop from "@/models/Shop";
import Product from "@/models/Product";
import { getCached, setCache, invalidateCache } from "@/lib/cache";

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

    const query: Record<string, unknown> = {};

    const search = searchParams.get("search");
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { specialties: { $regex: search, $options: "i" } },
      ];
    }

    const locationId = searchParams.get("locationId");
    if (locationId) query.locationId = locationId;

    const ownerId = searchParams.get("ownerId");
    if (ownerId) query.ownerId = ownerId;

    const status = searchParams.get("status");
    if (status) query.status = status;

    const sort = searchParams.get("sort") || "rating";
    const order = searchParams.get("order") === "asc" ? 1 : -1;
    const trending = searchParams.get("trending") === "true";

    const id = searchParams.get("id");
    if (id) {
      const cacheKey = `shop:${id}`;
      const cached = getCached(cacheKey);
      if (cached) return NextResponse.json(cached);

      // Try finding by _id first, then by ownerId (shop settings passes userId)
      let shop = await Shop.findById(id)
        .select("name description ownerId locationId status contact hours coverImage profileImage images specialties rating totalReviews createdAt updatedAt")
        .lean();
      if (!shop) {
        shop = await Shop.findOne({ ownerId: id })
          .select("name description ownerId locationId status contact hours coverImage profileImage images specialties rating totalReviews createdAt updatedAt")
          .lean();
      }
      if (!shop) {
        return NextResponse.json({ error: "Shop not found" }, { status: 404 });
      }

      // Fetch owner info separately — faster than populate
      const User = (await import("@/models/User")).default;
      const owner = await User.findById(shop.ownerId)
        .select("firstName lastName email avatar")
        .lean();

      const productCount = await Product.countDocuments({ shopId: shop._id });

      const result = {
        shop: {
          id: shop._id.toString(),
          name: shop.name,
          description: shop.description,
          ownerId: owner
            ? { id: toStr(owner._id), firstName: owner.firstName, lastName: owner.lastName, email: owner.email, avatar: owner.avatar }
            : { id: toStr(shop.ownerId) },
          locationId: shop.locationId,
          status: shop.status,
          contact: shop.contact,
          hours: shop.hours,
          coverImage: shop.coverImage,
          profileImage: shop.profileImage,
          images: shop.images,
          specialties: shop.specialties,
          rating: shop.rating,
          totalReviews: shop.totalReviews,
          productCount,
          createdAt: shop.createdAt,
          updatedAt: shop.updatedAt,
        },
      };
      setCache(cacheKey, result, 60_000); // 60s cache
      return NextResponse.json(result);
    }

    // Build cache key from query params
    const cacheKey = `shops:${JSON.stringify({ locationId, ownerId, search, status, sort, order })}`;
    const cached = getCached(cacheKey);
    if (cached) return NextResponse.json(cached);

    const shops = await Shop.find(query)
      .sort(trending ? { updatedAt: -1 } : { [sort]: order })
      .select("name ownerId locationId status coverImage profileImage specialties rating totalReviews totalViews createdAt updatedAt")
      .limit(100)
      .lean();

    if (shops.length === 0) {
      const result = { shops: [] };
      setCache(cacheKey, result, 60_000);
      return NextResponse.json(result);
    }

    // Batch fetch owners — single query instead of N
    const ownerIds = [...new Set(shops.map((s) => toStr(s.ownerId)).filter(Boolean))];
    const User = (await import("@/models/User")).default;
    const owners = ownerIds.length > 0
      ? await User.find({ _id: { $in: ownerIds } })
          .select("firstName lastName email avatar")
          .lean()
      : [];
    const ownerMap = new Map<string, Record<string, unknown>>();
    owners.forEach((o) => ownerMap.set(toStr(o._id), o as unknown as Record<string, unknown>));

    // Batch count products — single aggregation instead of N queries
    const shopIds = shops.map((s) => s._id);
    const productCounts = await Product.aggregate([
      { $match: { shopId: { $in: shopIds } } },
      { $group: { _id: "$shopId", count: { $sum: 1 } } },
    ]);    const countMap = new Map<string, number>();
    productCounts.forEach((pc) => countMap.set(toStr(pc._id), pc.count));

    // A few in-stock product images per shop so shop cards can preview what
    // the shop actually sells (one query for the whole page).
    const previewProducts = await Product.find({
      shopId: { $in: shopIds },
      isAvailable: true,
    })
      .sort({ updatedAt: -1 })
      .select("name description price originalPrice discount images category stock isAvailable shopId views rating reviews tags createdAt updatedAt")
      .limit(300)
      .lean();

    const previewMap = new Map<string, Array<Record<string, unknown>>>();
    previewProducts.forEach((product) => {
      const shopId = toStr(product.shopId);
      const list = previewMap.get(shopId) || [];
      if (list.length >= 3) return;
      list.push({ ...product, id: product._id.toString(), shopId });
      previewMap.set(shopId, list);
    });

    // Build shop data with trending score
    let shopsWithScore = shops.map((shop) => {
      const owner = ownerMap.get(toStr(shop.ownerId));
      const productCount = countMap.get(shop._id.toString()) || 0;

      // Calculate trending score: views + products + rating + recency
      const shopObj = shop as unknown as Record<string, unknown>;
      let trendingScore = 0;
      trendingScore += (Number(shopObj.totalViews) || 0) * 0.3;
      trendingScore += productCount * 10;
      trendingScore += (shop.rating || 0) * 20;
      trendingScore += (shop.totalReviews || 0) * 5;
      // Recency bonus (shops updated in last 7 days get a boost)
      const daysSinceUpdate = (Date.now() - new Date(shop.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 1) trendingScore += 50;
      else if (daysSinceUpdate < 7) trendingScore += 30;
      else if (daysSinceUpdate < 30) trendingScore += 10;

      return {
        id: shop._id.toString(),
        name: shop.name,
        ownerId: owner
          ? { id: toStr(shop.ownerId), firstName: owner.firstName, lastName: owner.lastName, email: owner.email, avatar: owner.avatar }
          : { id: toStr(shop.ownerId) },
        locationId: shop.locationId,
        status: shop.status,
        contact: shop.contact,
        coverImage: shop.coverImage,
        profileImage: shop.profileImage,
        images: shop.images,
        specialties: shop.specialties,
        rating: shop.rating,
        totalReviews: shop.totalReviews,
        productCount,
        totalViews: Number(shopObj.totalViews) || 0,
        trendingScore,
        previewProducts: previewMap.get(shop._id.toString()) || [],
        createdAt: shop.createdAt,
        updatedAt: shop.updatedAt,
      };
    });

    // Sort by trending score if requested
    if (trending) {
      shopsWithScore.sort((a, b) => b.trendingScore - a.trendingScore);
    }

    const result = { shops: shopsWithScore };
    setCache(cacheKey, result, 60_000); // 60s cache
    return NextResponse.json(result);
  } catch (error) {
    console.error("Shops GET error:", error);
    return NextResponse.json({ error: "Failed to fetch shops" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: "Shop ID is required" }, { status: 400 });
    }

    // Find by _id first, then by ownerId (shop settings passes userId)
    let shop = await Shop.findById(id).lean();
    if (!shop) {
      shop = await Shop.findOne({ ownerId: id }).lean();
    }
    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    // Update using the actual shop _id
    const updatedShop = await Shop.findByIdAndUpdate(shop._id, updateData, { new: true }).lean();
    if (!updatedShop) {
      return NextResponse.json({ error: "Failed to update shop" }, { status: 500 });
    }

    // Sync shop profileImage to User.avatar so it reflects everywhere
    if (updateData.profileImage !== undefined) {
      try {
        const User = (await import("@/models/User")).default;
        await User.findByIdAndUpdate(updatedShop.ownerId, { avatar: updateData.profileImage });
        invalidateCache(`profile:${updatedShop.ownerId}`);
      } catch (e) {
        console.error("Failed to sync avatar:", e);
      }
    }

    // Invalidate shops cache so new data is fetched
    invalidateCache("shops:");
    invalidateCache("shop:");

    return NextResponse.json({ shop: { ...shop, id: shop._id.toString() } });
  } catch (error) {
    console.error("Shops PUT error:", error);
    return NextResponse.json({ error: "Failed to update shop" }, { status: 500 });
  }
}
