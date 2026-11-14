import { NextResponse } from "next/server";
import { getCached, setCache } from "@/lib/cache";
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
 * Counts for the storefront filter panel ("Electronics (124)"), over every
 * product the storefront lists. Cached briefly: they change slowly.
 */
export async function GET() {
  try {
    const cached = getCached<Facets>("products:facets");
    if (cached) return NextResponse.json(cached);

    await connectToDatabase();
    // Same base set as the storefront grid: available products with media.
    const [result] = await Product.aggregate([
      { $match: { isAvailable: true, images: { $elemMatch: { $regex: /\S/ } } } },
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
    setCache("products:facets", facets, 60_000);
    return NextResponse.json(facets);
  } catch (error) {
    console.error("Product facets error:", error);
    return NextResponse.json({ error: "Failed to load filters" }, { status: 500 });
  }
}
