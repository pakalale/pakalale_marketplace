import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { createNotification } from "@/lib/notifications";
import { getSessionUser } from "@/lib/session";
import {
  canCancelOrder,
  isOrderStatus,
  normalizeOrderStatus,
  type OrderStatus,
} from "@/lib/orderStatus";
import Order from "@/models/Order";
import Product from "@/models/Product";
import Shop from "@/models/Shop";
import User from "@/models/User";
import { FeedPost } from "@/models/FeedPost";

const DELIVERY_FEES = { yango: 60, indrive: 60, pickup: 0 } as const;

const notSignedIn = () => NextResponse.json({ error: "Please sign in" }, { status: 401 });
const forbidden = () => NextResponse.json({ error: "You cannot access this order" }, { status: 403 });

const TRANSITION_ERROR = "That step is not available for this order any more";

function populateToStr(val: unknown): Record<string, unknown> | string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null && "_id" in val) {
    const obj = val as Record<string, unknown>;
    return { ...obj, id: String(obj._id) };
  }
  return String(val);
}

function trackingUrl(token?: string) {
  if (!token) return undefined;
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
  return `${base}/track/${token}`;
}

/** What the customer is allowed to see about the person carrying the order. */
function publicDeliveryAgent(agent: Record<string, unknown> | undefined) {
  if (!agent) return undefined;
  return {
    name: agent.name,
    phone: agent.phone,
    location: agent.location,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser(request);
    if (!session) return notSignedIn();

    await connectToDatabase();
    const { searchParams } = new URL(request.url);

    const query: Record<string, unknown> = {};
    const singleId = searchParams.get("id");
    if (singleId) {
      if (!mongoose.isValidObjectId(singleId)) {
        return NextResponse.json({ error: "Invalid order" }, { status: 400 });
      }
      query._id = singleId;
    }

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
    // A single-order read checks access after loading, since either party may ask for it.
    if (session.role !== "admin" && !ownsShop && !singleId) {
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
      .limit(singleId ? 1 : 200)
      .populate("customerId", "firstName lastName email")
      .populate("shopId", "name ownerId profileImage locationId")
      .populate("items.productId", "name images")
      .lean();

    if (singleId && orders.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (singleId) {
      // Either party on the order may read it, nobody else.
      const only = orders[0];
      const populatedShop = only.shopId as unknown as Record<string, unknown>;
      const ownerId =
        populatedShop && typeof populatedShop === "object" && "ownerId" in populatedShop
          ? String(populatedShop.ownerId)
          : undefined;
      const populatedCustomer = only.customerId as unknown as Record<string, unknown>;
      const orderCustomerId =
        populatedCustomer && typeof populatedCustomer === "object" && "_id" in populatedCustomer
          ? String(populatedCustomer._id)
          : String(only.customerId);
      if (session.role !== "admin" && ownerId !== session.id && orderCustomerId !== session.id) {
        return forbidden();
      }
    }

    return NextResponse.json({
      orders: orders.map((o) => {
        const populatedShop = o.shopId as unknown as Record<string, unknown>;
        const shopOwnerId =
          populatedShop && typeof populatedShop === "object" && "ownerId" in populatedShop
            ? String(populatedShop.ownerId)
            : undefined;
        // A single-order read has no shopId param, so ownership is decided from the order itself.
        const seenByOwner = session.role === "admin" || ownsShop || shopOwnerId === session.id;
        return {
          ...o,
          id: o._id.toString(),
          status: normalizeOrderStatus(o.status),
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
          // The tracking token is a shared secret: only the shop (or admin) gets the link.
          deliveryAgent: seenByOwner
            ? {
                ...o.deliveryAgent,
                trackingUrl: trackingUrl(o.deliveryAgent?.trackingToken),
              }
            : publicDeliveryAgent(o.deliveryAgent as Record<string, unknown> | undefined),
        };
      }),
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

    const customer = await User.findById(customerId).select("firstName lastName").lean();
    const customerName = [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || "Customer";
    const customerPhone = body.customerPhone.trim().slice(0, 40);
    const total = serverTotal + DELIVERY_FEES[deliveryMethod];
    const order = await Order.create({
      customerId,
      shopId,
      items: orderItems,
      status: "order_placed",
      subtotal: serverTotal,
      deliveryMethod,
      deliveryFee: DELIVERY_FEES[deliveryMethod],
      total,
      paymentMethod,
      customerPhone,
      deliveryAddress: typeof body.deliveryAddress === "string" ? body.deliveryAddress.trim().slice(0, 500) : "",
      notes: typeof notes === "string" ? notes.slice(0, 1000) : undefined,
    });

    const orderRef = `#${order._id.toString().slice(-6).toUpperCase()}`;
    const orderKind = deliveryMethod === "pickup" ? "pickup" : "delivery";

    // Both parties are told the moment the order exists.
    await Promise.all([
      createNotification({
        userId: shop.ownerId.toString(),
        type: "order",
        title: `New order ${orderRef}`,
        message: `${customerName} (${customerPhone}) placed a ${orderKind} order worth K${total.toLocaleString()}. Approve it to start preparing.`,
        actionUrl: "/shop/orders",
        relatedId: order._id.toString(),
      }),
      createNotification({
        userId: customerId,
        type: "order",
        title: `Order placed ${orderRef}`,
        message: `${shop.name} has received your ${orderKind} order worth K${total.toLocaleString()}. You will be notified when it is approved.`,
        actionUrl: "/customer/orders",
        relatedId: order._id.toString(),
      }),
    ]).catch((error) => console.error("Order placed notifications failed:", error));

    return NextResponse.json({ order: { ...order.toObject(), id: order._id.toString() } }, { status: 201 });
  } catch (error) {
    console.error("Orders POST error:", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}

interface TransitionInput {
  status?: unknown;
  deliveryAgent?: { name?: unknown; phone?: unknown };
}

/**
 * Records the sale for a completed order: the shop's counters go up and each
 * ordered product loses the ordered quantity from stock. Guarded by
 * `saleRecordedAt` so a double confirm cannot discount stock twice.
 */
async function recordSale(orderId: mongoose.Types.ObjectId) {
  const claimed = await Order.findOneAndUpdate(
    { _id: orderId, saleRecordedAt: { $exists: false } },
    { $set: { saleRecordedAt: new Date() } },
    { new: true }
  )
    .select("shopId items total")
    .lean();
  if (!claimed) return false;

  const now = new Date();
  await Promise.all([
    ...claimed.items.map((item) =>
      Product.updateOne(
        { _id: item.productId },
        [
          {
            $set: {
              // Clamped at zero so a stale stock count cannot go negative.
              stock: { $max: [0, { $subtract: ["$stock", item.quantity] }] },
              soldCount: { $add: [{ $ifNull: ["$soldCount", 0] }, item.quantity] },
              lastSoldAt: now,
              isAvailable: {
                $cond: [{ $gt: [{ $subtract: ["$stock", item.quantity] }, 0] }, true, false],
              },
            },
          },
        ],
        { updatePipeline: true }
      )
    ),
    Shop.updateOne(
      { _id: claimed.shopId },
      [
        {
          $set: {
            totalSales: { $add: [{ $ifNull: ["$totalSales", 0] }, 1] },
            totalRevenue: { $add: [{ $ifNull: ["$totalRevenue", 0] }, claimed.total] },
          },
        },
      ],
      { updatePipeline: true }
    ),
  ]);
  return true;
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionUser(request);
    if (!session) return notSignedIn();

    await connectToDatabase();
    const body: TransitionInput & { id?: string } = await request.json();
    const { id } = body;

    if (!id || !mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    const existing = await Order.findById(id)
      .select("shopId customerId status deliveryMethod total deliveryAgent")
      .lean();
    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const shop = await Shop.findById(existing.shopId).select("name ownerId").lean();
    const isShopOwner = shop?.ownerId?.toString() === session.id;
    const isCustomer = existing.customerId.toString() === session.id;
    const current = normalizeOrderStatus(existing.status);

    const update: Record<string, unknown> = {};

    // ── Delivery agent details (name, phone) from the shop ──
    if (body.deliveryAgent && (isShopOwner || session.role === "admin")) {
      if (body.deliveryAgent.name !== undefined) {
        update["deliveryAgent.name"] = String(body.deliveryAgent.name).slice(0, 80);
      }
      if (body.deliveryAgent.phone !== undefined) {
        update["deliveryAgent.phone"] = String(body.deliveryAgent.phone).slice(0, 40);
      }
    }

    // ── Status transition ──
    let next: OrderStatus | null = null;
    if (body.status !== undefined) {
      if (!isOrderStatus(body.status)) {
        return NextResponse.json({ error: "Invalid order status" }, { status: 400 });
      }
      next = body.status;

      const isAdmin = session.role === "admin";

      if (next === "cancelled") {
        if (!isAdmin && !(isShopOwner || isCustomer)) return forbidden();
        if (!canCancelOrder(current)) {
          return NextResponse.json({ error: TRANSITION_ERROR }, { status: 409 });
        }
      } else if (next === "completed") {
        // Only the customer closes the loop, and only once the goods arrived.
        if (!isAdmin && !isCustomer) return forbidden();
        if (current !== "delivered") {
          return NextResponse.json({ error: TRANSITION_ERROR }, { status: 409 });
        }
      } else {
        // Shop-driven steps: placed → approved → delivery in progress → delivered.
        if (!isAdmin && !isShopOwner) return forbidden();
        const allowed: Record<string, OrderStatus> = {
          order_placed: "approved",
          approved: "delivery_in_progress",
          delivery_in_progress: "delivered",
        };
        if (allowed[current] !== next) {
          return NextResponse.json({ error: TRANSITION_ERROR }, { status: 409 });
        }
      }
      update.status = next;

      // The agent's tracking link is minted when a delivery order leaves the shop.
      // Pickup orders never carry one: there is no agent to follow.
      if (
        next === "delivery_in_progress" &&
        existing.deliveryMethod !== "pickup" &&
        !existing.deliveryAgent?.trackingToken
      ) {
        update["deliveryAgent.trackingToken"] = crypto.randomBytes(16).toString("hex");
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const order = await Order.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (next === "completed") {
      // Sale is recorded before responding so the shop's numbers and stock are
      // already correct when the customer sees "Completed".
      await recordSale(order._id);
    }

    if (next) {
      const orderRef = `#${order._id.toString().slice(-6).toUpperCase()}`;
      const customerId = existing.customerId.toString();
      const shopOwnerId = shop?.ownerId?.toString();
      const shopName = shop?.name || "The shop";

      type Notice = Parameters<typeof createNotification>[0];
      const notices: Notice[] = [];

      if (next === "cancelled") {
        const byShop = isShopOwner || session.role === "admin";
        if (byShop && customerId) {
          notices.push({
            userId: customerId,
            type: "order",
            title: `Order cancelled ${orderRef}`,
            message: `${shopName} cancelled this order. You can place it again from the shop.`,
            actionUrl: "/customer/orders",
            relatedId: order._id.toString(),
          });
        }
        if (!byShop && shopOwnerId) {
          notices.push({
            userId: shopOwnerId,
            type: "order",
            title: `Order cancelled ${orderRef}`,
            message: "The customer cancelled this order.",
            actionUrl: "/shop/orders",
            relatedId: order._id.toString(),
          });
        }
      } else if (next === "approved" && customerId) {
        notices.push({
          userId: customerId,
          type: "order",
          title: `Order approved ${orderRef}`,
          message: `${shopName} approved your order and is preparing it in store.`,
          actionUrl: "/customer/orders",
          relatedId: order._id.toString(),
        });
      } else if (next === "delivery_in_progress" && customerId) {
        notices.push({
          userId: customerId,
          type: "order",
          title: existing.deliveryMethod === "pickup" ? `Ready for pickup ${orderRef}` : `Delivery in progress ${orderRef}`,
          message:
            existing.deliveryMethod === "pickup"
              ? `Your order is ready to collect at ${shopName}.`
              : `${shopName} handed your order to the delivery agent. Tap the map icon on the order to follow it.`,
          actionUrl: "/customer/orders",
          relatedId: order._id.toString(),
        });
      } else if (next === "delivered") {
        if (customerId) {
          notices.push({
            userId: customerId,
            type: "order",
            title: `Order delivered ${orderRef}`,
            message: `Your order from ${shopName} has been delivered. Confirm you received it to complete the order.`,
            actionUrl: "/customer/orders",
            relatedId: order._id.toString(),
          });
        }
        if (shopOwnerId) {
          notices.push({
            userId: shopOwnerId,
            type: "order",
            title: `Order delivered ${orderRef}`,
            message: "The delivery agent marked this order as delivered. Waiting for the customer to confirm.",
            actionUrl: "/shop/orders",
            relatedId: order._id.toString(),
          });
        }
      } else if (next === "completed" && shopOwnerId) {
        notices.push({
          userId: shopOwnerId,
          type: "order",
          title: `Order completed ${orderRef}`,
          message: `The customer confirmed receipt. Sale of K${Number(order.total).toLocaleString()} recorded and stock updated.`,
          actionUrl: "/shop/orders",
          relatedId: order._id.toString(),
        });
      }

      if (notices.length > 0) {
        await Promise.all(notices.map((notice) => createNotification(notice))).catch((error) =>
          console.error("Order update notifications failed:", error)
        );
      }
    }

    return NextResponse.json({
      order: {
        ...order,
        id: order._id.toString(),
        status: normalizeOrderStatus(order.status),
      },
    });
  } catch (error) {
    console.error("Orders PUT error:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
