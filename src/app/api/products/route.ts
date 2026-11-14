import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { requireSession, forbidden } from "@/lib/session";
import Product from "@/models/Product";
import Shop from "@/models/Shop";
import { Location } from "@/models/FeedPost";

// Keep the populated shop reference on public product cards so the storefront
// can show "Sold by <shop>" without a second request per product.
function toShopRef(val: unknown) {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (val instanceof mongoose.Types.ObjectId) return val.toString();
  if (typeof val === "object" && val !== null && "_id" in val) {
    const shop = val as Record<string, unknown>;
    return {
      id: String(shop._id),
      name: typeof shop.name === "string" ? shop.name : "",
      locationId: typeof shop.locationId === "string" ? shop.locationId : "",
      rating: typeof shop.rating === "number" ? shop.rating : 0,
    };
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
      // Escape user input so searches like "c++" or "(new" are literal text.
      const pattern = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { name: { $regex: pattern, $options: "i" } },
        { tags: { $regex: pattern, $options: "i" } },
        { category: { $regex: pattern, $options: "i" } },
        { description: { $regex: pattern, $options: "i" } },
      ];
    }

    // Repeat the param (?category=a&category=b) to match any of several categories.
    const categoryParams = searchParams.getAll("category").filter((value) => value && value !== "all");
    if (categoryParams.length === 1) {
      query.category = categoryParams[0];
    } else if (categoryParams.length > 1) {
      query.category = { $in: categoryParams };
    }

    // Product media filters distinguish photo-only callers from mixed-media listings.
    if (searchParams.get("hasMedia") === "true") {
      query.images = { $elemMatch: { $regex: /\S/ } };
    } else if (searchParams.get("hasImage") === "true") {
      query.images = { $elemMatch: { $gt: "", $not: /\/video\/upload\/|\.(mp4|webm|mov|avi|mkv)(\?|$)/i } };
    }

    if (searchParams.get("onSale") === "true") {
      query.$expr = { $gt: ["$originalPrice", "$price"] };
    }

    const shopIdParam = searchParams.get("shopId");
    if (shopIdParam) {
      // Resolve ownerId to Shop._id if needed
      let resolvedShopId = shopIdParam;
      const existingShop = await Shop.findById(shopIdParam).select("_id").lean();
      if (!existingShop) {
        // The passed ID might be an ownerId (user ID) — find the shop by ownerId
        const shopByOwner = await Shop.findOne({ ownerId: shopIdParam }).select("_id").lean();
        if (shopByOwner) {
          resolvedShopId = shopByOwner._id.toString();
        }
      }
      query.shopId = resolvedShopId;
    }

    const available = searchParams.get("available");
    if (available === "true") {
      query.isAvailable = true;
    }

    // Market filter: products do not store a location, so resolve the shops in
    // that market (by id or slug) and filter products by those shop ids.
    const locationId = searchParams.get("locationId");
    if (locationId && !shopIdParam) {
      const locationQuery: Record<string, unknown>[] = [{ slug: locationId }];
      if (mongoose.isValidObjectId(locationId)) locationQuery.push({ _id: locationId });
      const location = await Location.findOne({ $or: locationQuery }).lean();
      const locationIds = [locationId, location?._id?.toString(), location?.slug].filter(Boolean) as string[];
      const shopsInLocation = await Shop.find({ locationId: { $in: locationIds } }).select("_id").lean();
      query.shopId = { $in: shopsInLocation.map((shop) => shop._id) };
    }

    const sort = searchParams.get("sort") || "createdAt";
    const order = searchParams.get("order") === "asc" ? 1 : -1;

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const [products, total, categories] = await Promise.all([
      Product.find(query)
        .sort({ [sort]: order })
        .skip(skip)
        .limit(limit)
        .populate("shopId", "name locationId rating")
        .lean(),
      Product.countDocuments(query),
      Product.distinct("category", { isAvailable: true }),
    ]);

    return NextResponse.json({
      products: products.map((p) => ({
        ...p,
        id: p._id.toString(),
        shopId: toShopRef(p.shopId),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      categories: (categories as string[]).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    });
  } catch (error) {
    console.error("Products GET error:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

/** True when the caller owns the product's shop, or is an admin. */
async function canManageProduct(user: { id: string; role: string }, productId: string) {
  if (user.role === "admin") return true;
  if (!mongoose.isValidObjectId(productId)) return false;
  const product = await Product.findById(productId).select("shopId").lean();
  if (!product) return false;
  return Boolean(await Shop.exists({ _id: product.shopId, ownerId: user.id }));
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession(request, { roles: ["shop_owner", "admin"] });
    if (auth.response) return auth.response;

    await connectToDatabase();
    // Ratings, reviews and views are earned, not set by the seller.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { views, rating, reviews, demandScore, ...body } = await request.json();

    if (typeof body.description !== "string" || !body.description.trim()) {
      return NextResponse.json({ error: "Product description is required" }, { status: 400 });
    }

    const hasProductPhoto = Array.isArray(body.images) && body.images.some(
      (image: unknown) =>
        typeof image === "string" &&
        image.trim() &&
        !/\/video\/upload\/|\.(mp4|webm|mov)(\?|$)/i.test(image)
    );
    if (!hasProductPhoto) {
      return NextResponse.json({ error: "At least one product photo is required" }, { status: 400 });
    }

    // Sellers can only add to their own shop. Admins may name any shop.
    if (auth.user.role === "admin" && body.shopId) {
      const existingShop = await Shop.findById(body.shopId).select("_id").lean();
      const shop = existingShop || (await Shop.findOne({ ownerId: body.shopId }).select("_id").lean());
      if (!shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 });
      body.shopId = shop._id;
    } else {
      const ownShop = await Shop.findOne({ ownerId: auth.user.id }).select("_id").lean();
      if (!ownShop) return NextResponse.json({ error: "Create your shop first" }, { status: 400 });
      body.shopId = ownShop._id;
    }

    const product = await Product.create(body);
    return NextResponse.json({ product: { ...product.toObject(), id: product._id.toString() } }, { status: 201 });
  } catch (error) {
    console.error("Products POST error:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireSession(request, { roles: ["shop_owner", "admin"] });
    if (auth.response) return auth.response;

    await connectToDatabase();
    // A product cannot be moved to another shop or given ratings or views.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, shopId, views, rating, reviews, demandScore, ...updateData } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }
    if (!(await canManageProduct(auth.user, id))) return forbidden("You can only edit your own products");

    if (updateData.description !== undefined && (typeof updateData.description !== "string" || !updateData.description.trim())) {
      return NextResponse.json({ error: "Product description is required" }, { status: 400 });
    }

    const product = await Product.findByIdAndUpdate(id, updateData, { new: true }).lean();
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ product: { ...product, id: product._id.toString() } });
  } catch (error) {
    console.error("Products PUT error:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    const auth = await requireSession(request, { roles: ["shop_owner", "admin"] });
    if (auth.response) return auth.response;
    if (!(await canManageProduct(auth.user, id))) return forbidden("You can only delete your own products");

    await Product.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Products DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
