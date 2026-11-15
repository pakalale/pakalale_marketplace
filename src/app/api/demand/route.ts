import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import DemandRecord from "@/models/DemandRecord";
import Shop from "@/models/Shop";

function toStr(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (val instanceof mongoose.Types.ObjectId) return val.toString();
  if (typeof val === "object" && val !== null && "_id" in val) {
    return String((val as { _id: unknown })._id);
  }
  return String(val);
}

// Simple keyword extraction for demand parsing
function parseIntent(query: string) {
  const lower = query.toLowerCase();
  const tokens = lower.split(/\s+/).filter((t) => t.length > 1);

  const knownBrands = [
    "samsung", "apple", "iphone", "tecno", "hp", "nike", "adidas", "puma",
    "sony", "jbl", "xiaomi", "huawei", "infinix", "playstation", "xbox", "nintendo",
  ];
  const knownColors = [
    "black", "white", "red", "blue", "green", "yellow", "pink", "purple",
    "orange", "grey", "gray", "brown", "gold", "silver", "navy", "beige",
  ];
  const categoryMap: Record<string, string> = {
    phone: "Mobile Phones", smartphone: "Mobile Phones",
    laptop: "Laptops", shoe: "Shoes", shoes: "Shoes",
    dress: "Women's Wear", shirt: "Men's Wear", jacket: "Outerwear",
    sofa: "Living Room", bed: "Bedroom", tv: "Electronics",
    headphone: "Accessories", headphones: "Accessories",
    console: "Consoles", game: "Games",
    mouse: "PC Gaming", keyboard: "PC Gaming",
    bag: "Accessories", watch: "Accessories",
  };

  const brand = tokens.find((t) => knownBrands.some((b) => b.includes(t) || t.includes(b))) || undefined;
  const color = tokens.find((t) => knownColors.includes(t)) || undefined;
  let productType: string | undefined;
  for (const [key, val] of Object.entries(categoryMap)) {
    if (tokens.some((t) => t.includes(key) || key.includes(t))) {
      productType = val;
      break;
    }
  }

  // Extract price
  let priceMax: number | undefined;
  const priceMatch = lower.match(/(?:under|below|less than|max|up to)\s*(?:k|kwacha)?\s*(\d[\d,]*)/i);
  if (priceMatch) {
    priceMax = parseInt(priceMatch[1].replace(/,/g, ""));
  }
  const priceMatch2 = lower.match(/k\s*(\d[\d,]*)/i);
  if (!priceMax && priceMatch2) {
    priceMax = parseInt(priceMatch2[1].replace(/,/g, ""));
  }

  // Extract size if present
  const sizeMatch = lower.match(/(?:size|sz)\s*(\d+)/i);
  const attributes: Record<string, string> = {};
  if (sizeMatch) attributes.size = sizeMatch[1];

  return { productType, brand, color, priceMax, attributes: Object.keys(attributes).length > 0 ? attributes : undefined };
}

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get("locationId");
    const category = searchParams.get("category");
    const status = searchParams.get("status") || "active";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (status && status !== "all") query.status = status;
    if (locationId) query.locationId = locationId;
    if (category) query["parsedIntent.productType"] = { $regex: category, $options: "i" };

    const [records, total] = await Promise.all([
      DemandRecord.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("customerId", "firstName lastName avatar location")
        .populate("responses.shopId", "name locationId specialties rating")
        .populate("responses.productId", "name price images")
        .lean(),
      DemandRecord.countDocuments(query),
    ]);

    return NextResponse.json({
      demands: records.map((r) => ({
        id: r._id.toString(),
        customerId: toStr(r.customerId),
        customer: (() => {
          const c = r.customerId as unknown as Record<string, unknown> | null;
          if (c && "firstName" in c) {
            return { id: String(c._id), name: `${c.firstName} ${c.lastName}`, avatar: c.avatar, location: c.location };
          }
          return null;
        })(),
        query: r.query,
        parsedIntent: r.parsedIntent,
        locationId: r.locationId,
        status: r.status,
        responses: r.responses.map((resp) => ({
          shopId: toStr(resp.shopId),
          shop: (() => {
            const s = resp.shopId as unknown as Record<string, unknown> | null;
            if (s && "name" in s) return { id: String(s._id), name: s.name, locationId: s.locationId, rating: s.rating };
            return null;
          })(),
          responseType: resp.responseType,
          message: resp.message,
          productId: resp.productId ? toStr(resp.productId) : null,
          product: (() => {
            const p = resp.productId as unknown as Record<string, unknown> | null;
            if (p && "name" in p) return { id: String(p._id), name: p.name, price: p.price };
            return null;
          })(),
          timestamp: resp.timestamp,
        })),
        viewCount: r.viewCount,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Demand GET error:", error);
    return NextResponse.json({ error: "Failed to fetch demands" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { customerId, query: searchQuery, locationId, coordinates } = body;

    if (!customerId || !searchQuery) {
      return NextResponse.json({ error: "customerId and query are required" }, { status: 400 });
    }

    const parsedIntent = parseIntent(searchQuery);

    const record = await DemandRecord.create({
      customerId: new mongoose.Types.ObjectId(customerId),
      query: searchQuery,
      parsedIntent,
      locationId,
      coordinates,
    });

    // Notify shop owners about this demand
    const { createBulkNotifications } = await import("@/lib/notifications");
    const ShopModel = (await import("@/models/Shop")).default;
    // Try location-specific first, fall back to all shops
    let shopQuery: Record<string, unknown> = {};
    if (locationId) {
      shopQuery = { locationId };
    }
    const shops = await ShopModel.find(shopQuery).select("ownerId").lean();
    const ownerIds = [...new Set(shops.map((s) => toStr(s.ownerId)).filter((oid) => oid !== customerId))];      if (ownerIds.length > 0) {
        await createBulkNotifications(ownerIds, {
          type: "shop",
          title: "New customer request",
          message: `A customer is looking for: ${searchQuery}`,
          actionUrl: "/shop/feed",
        });
      }

    return NextResponse.json({
      demand: {
        id: record._id.toString(),
        query: record.query,
        parsedIntent: record.parsedIntent,
        locationId: record.locationId,
        status: record.status,
        createdAt: record.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Demand POST error:", error);
    return NextResponse.json({ error: "Failed to create demand record" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { id, action, shopId, responseType, message, productId } = body;

    if (!id) {
      return NextResponse.json({ error: "Demand record ID is required" }, { status: 400 });
    }

    if (action === "respond" && shopId) {
      const record = await DemandRecord.findById(id);
      if (!record) return NextResponse.json({ error: "Demand record not found" }, { status: 404 });

      record.responses.push({
        shopId: new mongoose.Types.ObjectId(shopId),
        responseType: responseType || "has_product",
        message,
        productId: productId ? new mongoose.Types.ObjectId(productId) : undefined,
        timestamp: new Date(),
      });
      await record.save();

      return NextResponse.json({ success: true, responsesCount: record.responses.length });
    }

    if (action === "view") {
      await DemandRecord.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });
      return NextResponse.json({ success: true });
    }

    if (action === "fulfill") {
      await DemandRecord.findByIdAndUpdate(id, { status: "fulfilled" });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Demand PUT error:", error);
    return NextResponse.json({ error: "Failed to update demand record" }, { status: 500 });
  }
}
