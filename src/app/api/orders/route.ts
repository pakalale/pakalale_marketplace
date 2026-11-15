import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { createNotification } from "@/lib/notifications";
import { getSessionUser } from "@/lib/session";
import Order from "@/models/Order";
import Product from "@/models/Product";
import Shop from "@/models/Shop";
import { FeedPost } from "@/models/FeedPost";
import { sellerOrderStatuses } from "@/lib/orderStatus";

const DELIVERY_FEES = { yango: 60, indrive: 60, pickup: 0 } as const;
const ORDER_STATUSES = ["order_received", "in_store", "out_for_delivery", "ready_for_pickup", "delivered", "received", "cancelled", "pending", "confirmed", "preparing", "ready", "completed"];

function allowedSellerTransition(current: string, next: string, deliveryMethod?: string) {
  if (next === "cancelled") return !["delivered", "received", "completed", "cancelled"].includes(current);
  if (current === "order_received" || ["pending", "confirmed", "preparing"].includes(current)) return next === "in_store";
  if (current === "in_store") return deliveryMethod === "pickup" ? next === "ready_for_pickup" : next === "out_for_delivery";
  if (current === "out_for_delivery") return next === "delivered";
  return false;
}

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
      .populate("shopId", "name ownerId profileImage locationId")
      .populate("items.productId", "name images")
      .lean();

    return NextResponse.json({
      orders: orders.map((o) => ({
        ...o,
        id: o._id.toString(),
        customerId: populateToStr(o.customerId),
        shopId: (() => {
          const shop = o.shopId as unknown as Record<string, unknown>;
          if (!shop || typeof shop !== "object" || !("_id" in shop)) return populateToStr(o.shopId);
          return { ...shop, id: String(shop._id), ownerId: String(shop.ownerId) };
        })(),
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
    if (session.role !== "customer") return forbidden();
    const customerId = session.id;

    await connectToDatabase();
    const body = await request.json();
    const { shopId, items, notes } = body;
    const deliveryMethod = body.deliveryMethod as keyof typeof DELIVERY_FEES;
    const paymentMethod = body.paymentMethod;
    const subtotalInput = Number(body.subtotal ?? body.total);

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
      !validLines ||
      !Object.hasOwn(DELIVERY_FEES, deliveryMethod) ||
      !["airtel_money", "cash"].includes(paymentMethod) ||
      (deliveryMethod !== "pickup" && paymentMethod !== "airtel_money") ||
      !Number.isFinite(subtotalInput) ||
      typeof body.customerPhone !== "string" ||
      !body.customerPhone.trim() ||
      (deliveryMethod !== "pickup" && (typeof body.deliveryAddress !== "string" || !body.deliveryAddress.trim()))
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

    const promotionPosts = products.length > 0
      ? await FeedPost.find({
          relatedShopId: shop._id,
          relatedProductId: { $in: products.map((product) => product._id) },
          isPromotion: true,
        })
          .sort({ createdAt: -1 })
          .select("relatedProductId product")
          .lean()
      : [];
    const promotionPrices = new Map<string, number>();
    promotionPosts.forEach((post) => {
      const productId = post.relatedProductId?.toString();
      const price = Number(post.product?.price);
      const originalPrice = Number(post.product?.originalPrice);
      if (productId && !promotionPrices.has(productId) && price > 0 && originalPrice > price) {
        promotionPrices.set(productId, price);
      }
    });
    const orderPrice = (product: (typeof products)[number]) => {
      const promotionPrice = promotionPrices.get(product._id.toString());
      return promotionPrice && promotionPrice < product.price ? promotionPrice : product.price;
    };

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
        const price = orderPrice(product);
        orderItems.push({ productId: product._id, quantity, price });
        serverTotal += price * quantity;
      }
    }

    const current = products.map((product) => ({
      productId: product._id.toString(),
      price: orderPrice(product),
      stock: product.stock,
      isAvailable: product.isAvailable,
    }));

    if (problems.length > 0) {
      return NextResponse.json({ error: problems.join(". "), current }, { status: 409 });
    }
    if (serverTotal !== subtotalInput) {
      return NextResponse.json(
        { error: "Prices have changed. Please review your order and try again.", current },
        { status: 409 }
      );
    }

    const order = await Order.create({
      customerId,
      shopId,
      items: orderItems,
      status: "order_received",
      subtotal: serverTotal,
      deliveryMethod,
      deliveryFee: DELIVERY_FEES[deliveryMethod],
      total: serverTotal + DELIVERY_FEES[deliveryMethod],
      paymentMethod,
      customerPhone: body.customerPhone.trim().slice(0, 40),
      deliveryAddress: typeof body.deliveryAddress === "string" ? body.deliveryAddress.trim().slice(0, 500) : "",
      notes: typeof notes === "string" ? notes.slice(0, 1000) : undefined,
    });

    await createNotification({
      userId: shop.ownerId.toString(),
      type: "order",
      title: "New order",
      message: `New ${deliveryMethod === "pickup" ? "pickup" : "delivery"} order worth K${(serverTotal + DELIVERY_FEES[deliveryMethod]).toLocaleString()} is waiting for you.`,
      actionUrl: "/shop/orders",
      relatedId: order._id.toString(),
    }).catch((error) => console.error("New order notification failed:", error));

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

    const existing = await Order.findById(id).select("shopId customerId status deliveryMethod").lean();
    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (session.role !== "admin") {
      if (status === "received") {
        const isCustomer = existing.customerId.toString() === session.id;
        if (!isCustomer || !["delivered", "ready_for_pickup"].includes(existing.status)) return forbidden();
      } else {
        const ownsShop = await Shop.exists({ _id: existing.shopId, ownerId: session.id });
        if (!ownsShop || !sellerOrderStatuses(existing.deliveryMethod).includes(status) || !allowedSellerTransition(existing.status, status, existing.deliveryMethod)) {
          return forbidden();
        }
      }
    }

    const order = await Order.findByIdAndUpdate(id, { status }, { new: true }).lean();
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const recipientId = status === "received" ? existing.shopId.toString() : existing.customerId.toString();
    const notification = status === "received"
      ? { title: "Order received", message: "The customer confirmed receiving this order." }
      : { title: "Order update", message: `Your order status is now ${status.replaceAll("_", " ")}.` };
    if (status !== "cancelled") {
      await createNotification({
        userId: status === "received"
          ? (await Shop.findById(existing.shopId).select("ownerId").lean())?.ownerId.toString() || recipientId
          : recipientId,
        type: "order",
        title: notification.title,
        message: notification.message,
        actionUrl: status === "received" ? "/shop/orders" : "/customer/orders",
        relatedId: order._id.toString(),
      });
    }

    return NextResponse.json({ order: { ...order, id: order._id.toString() } });
  } catch (error) {
    console.error("Orders PUT error:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
