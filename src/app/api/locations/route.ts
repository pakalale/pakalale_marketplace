import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Location } from "@/models/FeedPost";
import Shop from "@/models/Shop";
import Product from "@/models/Product";
import { getCached, setCache } from "@/lib/cache";

function toStr(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null && "_id" in val) {
    return String((val as { _id: unknown })._id);
  }
  return String(val);
}

/**
 * In-stock products grouped by shop, newest first. Used to show
 * what shops in a location actually sell.
 */
async function fetchShopPreviewProducts(shopIds: Types.ObjectId[]) {
  const map = new Map<string, Array<Record<string, unknown>>>();
  if (shopIds.length === 0) return map;

  const products = await Product.find({
    shopId: { $in: shopIds },
    isAvailable: true,
  })
    .sort({ updatedAt: -1 })
    .select("name description price originalPrice discount images category stock isAvailable shopId views rating reviews tags createdAt updatedAt")
    .limit(300)
    .lean();

  for (const product of products) {
    const shopId = toStr(product.shopId);
    const list = map.get(shopId) || [];
    if (list.length >= 9) continue;
    list.push({ ...product, id: product._id.toString(), shopId });
    map.set(shopId, list);
  }

  return map;
}

/** Total products listed by each shop (available or not). */
async function fetchProductCounts(shopIds: Types.ObjectId[]) {
  const map = new Map<string, number>();
  if (shopIds.length === 0) return map;

  const counts = (await Product.aggregate([
    { $match: { shopId: { $in: shopIds } } },
    { $group: { _id: "$shopId", count: { $sum: 1 } } },
  ])) as Array<{ _id: unknown; count: number }>;

  counts.forEach((c) => map.set(toStr(c._id), c.count));
  return map;
}

function collectLocationPreviews(
  shops: Array<{ _id: unknown; locationId?: string }>,
  previewMap: Map<string, Array<Record<string, unknown>>>,
  /** Shops may store a location's slug or its _id; normalise so they group together. */
  resolveKey: (locationId: string) => string = (locationId) => locationId
) {
  const shopsByLocation = new Map<string, Array<Array<Record<string, unknown>>>>();

  for (const shop of shops) {
    const locationKey = resolveKey(shop.locationId || "");
    if (!locationKey) continue;
    const shopProducts = previewMap.get(toStr(shop._id)) || [];
    const lists = shopsByLocation.get(locationKey) || [];
    lists.push(shopProducts);
    shopsByLocation.set(locationKey, lists);
  }

  const byLocation = new Map<string, Array<Record<string, unknown>>>();
  for (const [locationKey, shopProductLists] of shopsByLocation) {
    const products: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();
    for (let productIndex = 0; products.length < 9; productIndex += 1) {
      let foundAtIndex = false;
      for (const shopProducts of shopProductLists) {
        const product = shopProducts[productIndex];
        if (!product) continue;
        foundAtIndex = true;
        const id = String(product.id);
        if (!seen.has(id)) {
          seen.add(id);
          products.push(product);
          if (products.length === 9) break;
        }
      }
      if (!foundAtIndex) break;
    }
    byLocation.set(locationKey, products);
  }

  return byLocation;
}

function computeLocationStats(
  shops: Array<{ _id?: unknown; specialties?: string[]; rating?: number; totalReviews?: number; totalViews?: number }>,
  productCounts?: Map<string, number>
) {
  let totalRating = 0;
  let ratedCount = 0;
  let totalViews = 0;
  let productCount = 0;
  const specialties = new Set<string>();
  for (const shop of shops) {
    if (shop.rating) { totalRating += shop.rating; ratedCount++; }
    totalViews += shop.totalViews || 0;
    productCount += productCounts?.get(toStr(shop._id)) || 0;
    for (const s of (shop.specialties || [])) specialties.add(s);
  }
  return {
    shopCount: shops.length,
    rating: ratedCount > 0 ? Math.round((totalRating / ratedCount) * 10) / 10 : 0,
    specialties: Array.from(specialties),
    totalViews,
    productCount,
  };
}

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);

    const slug = searchParams.get("slug");
    if (slug) {
      // Callers pass a slug or an _id, and shops store whichever was submitted.
      const location = await Location.findOne({
        $or: [{ slug }, ...(Types.ObjectId.isValid(slug) ? [{ _id: slug }] : [])],
      }).lean();
      if (!location) {
        return NextResponse.json({ error: "Location not found" }, { status: 404 });
      }
      const locationKeys = [location._id.toString(), ...(location.slug ? [location.slug] : []), slug];
      // Compute real data from shops
      const shops = await Shop.find({ locationId: { $in: [...new Set(locationKeys)] } })
        .select("specialties rating totalReviews totalViews locationId")
        .lean();
      const [previewMap, productCounts] = await Promise.all([
        fetchShopPreviewProducts(shops.map((s) => s._id)),
        fetchProductCounts(shops.map((s) => s._id)),
      ]);
      const computed = computeLocationStats(shops, productCounts);
      const previews = collectLocationPreviews(shops, previewMap, () => location._id.toString());
      return NextResponse.json({
        location: {
          ...location,
          id: location._id.toString(),
          ...computed,
          previewProducts: previews.get(location._id.toString()) || [],
        },
      });
    }

    const id = searchParams.get("id");
    if (id) {
      const location = await Location.findById(id).lean();
      if (!location) {
        return NextResponse.json({ error: "Location not found" }, { status: 404 });
      }
      // Compute real data from shops
      const shops = await Shop.find({
        locationId: { $in: [location._id.toString(), ...(location.slug ? [location.slug] : [])] },
      })
        .select("specialties rating totalReviews totalViews locationId")
        .lean();
      const [previewMap, productCounts] = await Promise.all([
        fetchShopPreviewProducts(shops.map((s) => s._id)),
        fetchProductCounts(shops.map((s) => s._id)),
      ]);
      const computed = computeLocationStats(shops, productCounts);
      const locationPreviews = collectLocationPreviews(shops, previewMap, () => location._id.toString());
      return NextResponse.json({
        location: {
          ...location,
          id: location._id.toString(),
          ...computed,
          previewProducts: locationPreviews.get(location._id.toString()) || [],
        },
      });
    }

    const search = searchParams.get("search");
    const query: Record<string, unknown> = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { specialties: { $regex: search, $options: "i" } },
      ];
    }

    const specialty = searchParams.get("specialty");
    if (specialty && specialty !== "all") {
      query.specialties = specialty;
    }

    const cacheKey = `loc:${JSON.stringify({ search, specialty })}`;
    const cached = getCached(cacheKey);
    if (cached) return NextResponse.json(cached);

    const locations = await Location.find(query).sort({ name: 1 }).lean();

    // Compute real data from shops for each location
    const locationIds = locations.map((l) => l._id.toString());
    const locationSlugs = locations.map((l) => l.slug).filter(Boolean);
    const allIds = [...new Set([...locationIds, ...locationSlugs])];

    const shops = allIds.length > 0
      ? await Shop.find({ locationId: { $in: allIds } })
          .select("locationId specialties rating totalReviews totalViews")
          .lean()
      : [];

    const [previewMap, productCounts] = await Promise.all([
      fetchShopPreviewProducts(shops.map((s) => s._id)),
      fetchProductCounts(shops.map((s) => s._id)),
    ]);
    // Map every location slug/_id to the location's _id so shops stored under
    // either form are counted and previewed together.
    const canonicalKeys = new Map<string, string>();
    for (const l of locations) {
      const id = l._id.toString();
      canonicalKeys.set(id, id);
      if (l.slug) canonicalKeys.set(l.slug, id);
    }
    const resolveLocationKey = (key: string) => (key ? canonicalKeys.get(key) || key : "");
    const locationPreviews = collectLocationPreviews(shops, previewMap, resolveLocationKey);

    // Build location stats from real shop data
    const statsMap = new Map<string, { shopCount: number; avgRating: number; specialties: string[]; totalViews: number; totalReviews: number; productCount: number }>();
    for (const shop of shops) {
      const locId = resolveLocationKey(shop.locationId || "");
      const existing = statsMap.get(locId) || { shopCount: 0, avgRating: 0, specialties: [], totalViews: 0, totalReviews: 0, productCount: 0 };
      existing.shopCount += 1;
      existing.totalViews += (shop as unknown as Record<string, unknown>).totalViews as number || 0;
      existing.productCount += productCounts.get(toStr(shop._id)) || 0;
      existing.totalReviews += shop.totalReviews || 0;
      if (shop.rating) {
        existing.avgRating = ((existing.avgRating * (existing.shopCount - 1)) + shop.rating) / existing.shopCount;
      }
      for (const spec of (shop.specialties || [])) {
        if (!existing.specialties.includes(spec)) existing.specialties.push(spec);
      }
      statsMap.set(locId, existing);
    }

    const result = {
      locations: locations.map((l) => {
        const stats = statsMap.get(l._id.toString()) || { shopCount: 0, avgRating: 0, specialties: [], totalViews: 0, totalReviews: 0, productCount: 0 };
        return {
          ...l,
          id: l._id.toString(),
          shopCount: stats.shopCount || l.shopCount || 0,
          rating: stats.avgRating ? Math.round(stats.avgRating * 10) / 10 : (l.rating || 0),
          specialties: stats.specialties.length > 0 ? stats.specialties : (l.specialties || []),
          totalViews: stats.totalViews,
          productCount: stats.productCount || 0,
          previewProducts: locationPreviews.get(l._id.toString()) || [],
        };
      }),
    };
    setCache(cacheKey, result, 30_000);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Locations GET error:", error);
    return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 });
  }
}
