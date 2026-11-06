import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { createNotification } from "@/lib/notifications";
import { getSessionUser } from "@/lib/session";
import Order from "@/models/Order";
import Product from "@/models/Product";
import Shop from "@/models/Shop";

const ORDER_STATUSES = ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"];

const notSignedIn = () => NextResponse.json({ error: "Please sign in" }, { status: 401 });
const forbidden = () => NextResponse.json({ error: "You cannot access this order" }, { status: 403 });

function populateToStr(val: unknown): Record<string, unknown> | string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null && "_id" in val) {
    const obj = val as Record<string, unknown>;
    return { ...obj, id: String(obj._id) };
  }
  return String(val);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser(request);
    if (!session) return notSignedIn();

    await connectToDatabase();
    const { searchParams } = new URL(request.url);

    const query: Record<string, unknown> = {};
    const customerParam = searchParams.get("customerId");
    if (customerParam) query.customerId = customerParam;

    // Sellers query with their user id, while orders store the Shop id.
    const shopParam = searchParams.get("shopId");
    let ownsShop = false;
    if (shopParam) {
      if (!mongoose.isValidObjectId(shopParam)) {
        return NextResponse.json({ error: "Invalid shop" }, { status: 400 });
      }
      const shop = await Shop.findOne({ $or: [{ _id: shopParam }, { ownerId: shopParam }] })
        .select("ownerId")
        .lean();
      ownsShop = shop?.ownerId?.toString() === session.id;
      query.shopId = shop?._id ?? shopParam;
    }

    // Admins and a shop's owner may filter freely. Anyone else sees only their own orders.
    if (session.role !== "admin" && !ownsShop) {
      if (shopParam && customerParam !== session.id) return forbidden();
      if (customerParam && customerParam !== session.id) return forbidden();
      query.customerId = session.id;
    }

    const status = searchParams.get("status");
    if (status && status !== "all") query.status = status;

    const sort = searchParams.get("sort") || "createdAt";
    const order = searchParams.get("order") === "asc" ? 1 : -1;

    const orders = await Order.find(query)
      .sort({ [sort]: order })
      .populate("customerId", "firstName lastName email")
      .populate("shopId", "name")
      .populate("items.productId", "name images")
      .lean();

    return NextResponse.json({
      orders: orders.map((o) => ({
        ...o,
        id: o._id.toString(),
        customerId: populateToStr(o.customerId),
        shopId: populateToStr(o.shopId),
        items: o.items.map((item) => ({
          ...item,
          productId: populateToStr(item.productId),
        })),
      })),
    });
  } catch (error) {
    console.error("Orders GET error:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

interface OrderLineInput {
  productId?: unknown;
  quantity?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    // The order belongs to the signed-in caller, never to an ID in the request.
    const session = await getSessionUser(request);
    if (!session) return notSignedIn();
    const customerId = session.id;

    await connectToDatabase();
    const { shopId, items, total, notes, paymentMethod } = await request.json();

    const lines: OrderLineInput[] = Array.isArray(items) ? items : [];
    const validLines = lines.every(
      (line) =>
        mongoose.isValidObjectId(line?.productId) &&
        Number.isInteger(line?.quantity) &&
        (line.quantity as number) >= 1
    );
    if (
      !mongoose.isValidObjectId(shopId) ||
      lines.length === 0 ||
      !validLines
    ) {
      return NextResponse.json({ error: "Invalid order details" }, { status: 400 });
    }

    const [shop, products] = await Promise.all([
      Shop.findById(shopId).select("name ownerId").lean(),
      Product.find({ _id: { $in: lines.map((line) => line.productId as string) }, shopId })
        .select("name price stock isAvailable")
        .lean(),
    ]);
    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    // The database, not the browser cart, decides price and availability.
    const byId = new Map(products.map((product) => [product._id.toString(), product]));
    const orderItems = [];
    const problems: string[] = [];
    let serverTotal = 0;

    for (const line of lines) {
      const product = byId.get(String(line.productId));
      const quantity = line.quantity as number;
      if (!product || !product.isAvailable) {
        problems.push(`${product?.name || "A product"} is no longer available`);
      } else if (product.stock < quantity) {
        problems.push(`Only ${product.stock} of ${product.name} left`);
      } else {
        orderItems.push({ productId: product._id, quantity, price: product.price });
        serverTotal += product.price * quantity;
      }
    }

    const current = products.map((product) => ({
      productId: product._id.toString(),
      price: product.price,
      stock: product.stock,
      isAvailable: product.isAvailable,
    }));

    if (problems.length > 0) {
      return NextResponse.json({ error: problems.join(". "), current }, { status: 409 });
    }
    if (serverTotal !== total) {
      return NextResponse.json(
        { error: "Prices have changed. Please review your order and try again.", current },
        { status: 409 }
      );
    }

    const order = await Order.create({
      customerId,
      shopId,
      items: orderItems,
      total: serverTotal,
      paymentMethod: typeof paymentMethod === "string" ? paymentMethod.slice(0, 40) : undefined,
      notes: typeof notes === "string" ? notes.slice(0, 1000) : undefined,
    });

    await createNotification({
      userId: shop.ownerId.toString(),
      type: "order",
      title: "New order",
      message: `New order worth K${serverTotal.toLocaleString()} is waiting for you.`,
      actionUrl: "/shop/orders",
      relatedId: order._id.toString(),
    });

    return NextResponse.json({ order: { ...order.toObject(), id: order._id.toString() } }, { status: 201 });
  } catch (error) {
    console.error("Orders POST error:", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionUser(request);
    if (!session) return notSignedIn();

    await connectToDatabase();
    const { id, status } = await request.json();

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }
    if (!ORDER_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid order status" }, { status: 400 });
    }

    const existing = await Order.findById(id).select("shopId").lean();
    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Only the selling shop's owner (or an admin) moves an order along.
    if (session.role !== "admin") {
      const ownsShop = await Shop.exists({ _id: existing.shopId, ownerId: session.id });
      if (!ownsShop) return forbidden();
    }

    const order = await Order.findByIdAndUpdate(id, { status }, { new: true }).lean();
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ order: { ...order, id: order._id.toString() } });
  } catch (error) {
    console.error("Orders PUT error:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
