import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { getCached, setCache } from "@/lib/cache";
import { shopIdsInMarket } from "@/lib/marketShops";
import { connectToDatabase } from "@/lib/mongodb";
import Product from "@/models/Product";

interface Facets {
  categories: Array<{ name: string; count: number }>;
  brands: Array<{ name: string; count: number }>;
  inStock: number;
  onSale: number;
  price: { min: number; max: number };
}

/**
 * Counts for the filter panel ("Electronics (124)"). With ?locationId= or
 * ?shopId= they cover only that market or shop, so a market page counts its
 * own products. Cached briefly: they change slowly.
 */
export async function GET(request: NextRequest) {
  try {
    const market = request.nextUrl.searchParams.get("locationId") || "";
    const shop = request.nextUrl.searchParams.get("shopId") || "";
    if (shop && !mongoose.isValidObjectId(shop)) return NextResponse.json({ error: "Invalid shop" }, { status: 400 });
    const cacheKey = `products:facets:${market}:${shop}`;
    const cached = getCached<Facets>(cacheKey);
    if (cached) return NextResponse.json(cached);

    await connectToDatabase();
    const match: Record<string, unknown> = { isAvailable: true };
    if (shop) match.shopId = new mongoose.Types.ObjectId(shop);
    else if (market) match.shopId = { $in: await shopIdsInMarket(market) };

    const [result] = await Product.aggregate([
      { $match: match },
      {
        $facet: {
          categories: [{ $group: { _id: "$category", count: { $sum: 1 } } }],
          brands: [
            { $match: { brand: { $type: "string", $regex: /\S/ } } },
            { $group: { _id: "$brand", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 30 },
          ],
          inStock: [{ $match: { stock: { $gt: 0 } } }, { $count: "count" }],
          onSale: [{ $match: { $expr: { $gt: ["$originalPrice", "$price"] } } }, { $count: "count" }],
          price: [{ $group: { _id: null, min: { $min: "$price" }, max: { $max: "$price" } } }],
        },
      },
    ]);

    const facets: Facets = {
      categories: result.categories
        .filter((item: { _id: unknown }) => typeof item._id === "string" && item._id)
        .map((item: { _id: string; count: number }) => ({ name: item._id, count: item.count })),
      brands: result.brands.map((item: { _id: string; count: number }) => ({ name: item._id.trim(), count: item.count })),
      inStock: result.inStock[0]?.count ?? 0,
      onSale: result.onSale[0]?.count ?? 0,
      price: { min: Math.floor(result.price[0]?.min ?? 0), max: Math.ceil(result.price[0]?.max ?? 0) },
    };
    setCache(cacheKey, facets, 60_000);
    return NextResponse.json(facets);
  } catch (error) {
    console.error("Product facets error:", error);
    return NextResponse.json({ error: "Failed to load filters" }, { status: 500 });
  }
}
