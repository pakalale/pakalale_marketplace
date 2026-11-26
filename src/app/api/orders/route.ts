import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { createNotification } from "@/lib/notifications";
import { getSessionUser } from "@/lib/session";
import { cancelDelivery } from "@/lib/delivery";
import { bookOrderCourier, bookingUpdateFields } from "@/lib/delivery/booking";
import {
  DEFAULT_ORIGIN,
  addressHash,
  distanceBetweenKm,
  mockDropoff,
  verifyQuote,
} from "@/lib/delivery/pricing";
import { refundOrderPayment, settleOrderPayment } from "@/lib/escrow";
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
    vehicle: agent.vehicle,
    plate: agent.plate,
    location: agent.location,
  };
}

function validCoords(value: unknown): value is { lat: number; lng: number } {
  if (!value || typeof value !== "object") return false;
  const point = value as { lat?: unknown; lng?: unknown };
  return (
    typeof point.lat === "number" &&
    typeof point.lng === "number" &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180
  );
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
      .populate("shopId", "name ownerId profileImage locationId coordinates")
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
        const shopCoordinates =
          populatedShop && typeof populatedShop === "object" && "coordinates" in populatedShop
            ? (populatedShop.coordinates as { lat?: number; lng?: number } | undefined)
            : undefined;
        const customerPoint = o.customerLocation;
        const customerDistanceKm =
          shopCoordinates?.lat && shopCoordinates?.lng && customerPoint?.lat && customerPoint?.lng
            ? distanceBetweenKm(
                { lat: shopCoordinates.lat, lng: shopCoordinates.lng },
                { lat: customerPoint.lat, lng: customerPoint.lng }
              )
            : undefined;
        return {
          ...o,
          id: o._id.toString(),
          status: normalizeOrderStatus(o.status),
          customerDistanceKm,
          customerEtaMinutes:
            typeof customerDistanceKm === "number"
              ? Math.max(1, Math.round((customerDistanceKm / 25) * 60))
              : undefined,
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
    const deliveryMethod = body.deliveryMethod as "yango" | "pickup";
    const paymentMethod = body.paymentMethod;
    const subtotalInput = Number(body.subtotal ?? body.total);
    const deliveryAddress =
      typeof body.deliveryAddress === "string" ? body.deliveryAddress.trim().slice(0, 500) : "";

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
      !["yango", "pickup"].includes(deliveryMethod) ||
      // Pickup is cash on collection; delivery is paid into escrow up front.
      !["airtel_money", "cash"].includes(paymentMethod) ||
      (deliveryMethod === "pickup" ? paymentMethod !== "cash" : paymentMethod !== "airtel_money") ||
      !Number.isFinite(subtotalInput) ||
      typeof body.customerPhone !== "string" ||
      !body.customerPhone.trim() ||
      (deliveryMethod === "yango" && !deliveryAddress)
    ) {
      return NextResponse.json({ error: "Invalid order details" }, { status: 400 });
    }

    const [shop, products] = await Promise.all([
      Shop.findById(shopId).select("name ownerId coordinates contact.phone").lean(),
      Product.find({ _id: { $in: lines.map((line) => line.productId as string) }, shopId })
        .select("name price stock isAvailable")
        .lean(),
    ]);
    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    // The courier price is the one the customer confirmed at checkout: the
    // signed quote binds the shop, the provider and the delivery address.
    let deliveryQuote: ReturnType<typeof verifyQuote> = null;
    if (deliveryMethod === "yango") {
      const quote = verifyQuote(body.deliveryQuoteId);
      if (
        !quote ||
        quote.shopId !== String(shopId) ||
        quote.provider !== "yango" ||
        quote.addr !== addressHash(deliveryAddress)
      ) {
        return NextResponse.json(
          {
            error: "The delivery price has expired. Refresh it and try again.",
            code: "DELIVERY_QUOTE_EXPIRED",
          },
          { status: 409 }
        );
      }
      deliveryQuote = quote;
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
    const deliveryFee = deliveryQuote?.fee ?? 0;
    const total = serverTotal + deliveryFee;
    const pickupPoint =
      shop.coordinates?.lat && shop.coordinates?.lng
        ? { lat: shop.coordinates.lat, lng: shop.coordinates.lng }
        : DEFAULT_ORIGIN;
    const orderId = new mongoose.Types.ObjectId();
    const escrowReference = `esc_${orderId.toString().slice(-10)}`;

    const order = await Order.create({
      _id: orderId,
      customerId,
      shopId,
      items: orderItems,
      status: "order_placed",
      subtotal: serverTotal,
      deliveryMethod,
      deliveryFee,
      total,
      paymentMethod,
      customerPhone,
      deliveryAddress,
      notes: typeof notes === "string" ? notes.slice(0, 1000) : undefined,
      delivery: deliveryQuote
        ? {
            provider: "yango",
            quoteId: body.deliveryQuoteId,
            stage: "quoted",
            fee: deliveryQuote.fee,
            distanceKm: deliveryQuote.distanceKm,
            etaMinutes: deliveryQuote.etaMinutes,
            currency: "ZMW",
            pickup: pickupPoint,
            dropoff: mockDropoff(pickupPoint, deliveryQuote.distanceKm, deliveryAddress),
            mock: !process.env.YANGO_DELIVERY_TOKEN,
          }
        : undefined,
      escrow:
        deliveryMethod === "pickup"
          ? {
              status: "cash",
              amount: total,
              goodsAmount: serverTotal,
              deliveryFee: 0,
              reference: escrowReference,
            }
          : {
              status: "held",
              amount: total,
              goodsAmount: serverTotal,
              deliveryFee,
              reference: escrowReference,
              heldAt: new Date(),
            },
    });

    const orderRef = `#${order._id.toString().slice(-6).toUpperCase()}`;
    const orderKind = deliveryMethod === "pickup" ? "pickup" : "delivery";
    const paymentNote =
      deliveryMethod === "pickup"
        ? "Payment is cash on collection."
        : `K${total.toLocaleString()} will be released when you confirm receipt.`;

    // Both parties are told the moment the order exists.
    await Promise.all([
      createNotification({
        userId: shop.ownerId.toString(),
        type: "order",
        title: `New order ${orderRef}`,
        message: `${customerName} (${customerPhone}) placed a ${orderKind} order worth K${total.toLocaleString()}. ${paymentNote} Confirm it to ${deliveryMethod === "pickup" ? "prepare it for collection" : "book a Yango courier"}.`,
        actionUrl: "/shop/orders",
        relatedId: order._id.toString(),
      }),
      createNotification({
        userId: customerId,
        type: "order",
        title: `Order placed ${orderRef}`,
        message: `${shop.name} has received your ${orderKind} order worth K${total.toLocaleString()}. ${deliveryMethod === "pickup" ? "Pay cash when you collect it." : "Your payment will be released when you confirm delivery."} You will be notified when the shop confirms.`,
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
  customerLocation?: unknown;
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
      .select(
        "shopId customerId status deliveryMethod total subtotal deliveryFee paymentMethod deliveryAddress customerPhone notes delivery deliveryAgent"
      )
      .lean();
    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const shop = await Shop.findById(existing.shopId).select("name ownerId contact coordinates").lean();
    const isShopOwner = shop?.ownerId?.toString() === session.id;
    const isCustomer = existing.customerId.toString() === session.id;
    const current = normalizeOrderStatus(existing.status);

    const update: Record<string, unknown> = {};

    // ── Pickup: the customer shares their live position so the shop can see
    // how far away they are. Only the customer may set it, and only on pickup.
    if (body.customerLocation !== undefined) {
      if (!isCustomer && session.role !== "admin") return forbidden();
      if (existing.deliveryMethod !== "pickup") {
        return NextResponse.json(
          { error: "Location sharing is only used for pickup orders" },
          { status: 400 }
        );
      }
      if (!validCoords(body.customerLocation)) {
        return NextResponse.json({ error: "A valid location is required" }, { status: 400 });
      }
      update.customerLocation = {
        lat: body.customerLocation.lat,
        lng: body.customerLocation.lng,
        updatedAt: new Date(),
      };
    }

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
          // Delivery normally goes through agent_assigned automatically; this is
          // the manual hand-off path when the shop uses its own rider.
          approved: existing.deliveryMethod === "pickup" ? "delivered" : "delivery_in_progress",
          agent_assigned: "delivery_in_progress",
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

    let courier:
      | { name: string; phone: string; etaMinutes: number; mock: boolean }
      | undefined;
    let bookingError: string | undefined;
    let refunded = false;
    let deliveryCancelled = false;
    let settlement:
      | { status: string; amount: number; shopPayout: number; courierPayout: number; cash: boolean }
      | undefined;

    // Shop confirmed a delivery: book Yango now, not at checkout. Nothing is
    // charged to the courier until the shop has accepted the order.
    if (next === "approved" && existing.deliveryMethod === "yango") {
      const customer = await User.findById(existing.customerId).select("firstName lastName").lean();
      const customerName =
        [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || "Customer";
      try {
        const booked = await bookOrderCourier({
          id: order._id.toString(),
          provider: "yango",
          shopName: shop?.name || "Shop",
          shopPhone: shop?.contact?.phone,
          customerName,
          customerPhone: existing.customerPhone || "",
          deliveryAddress: existing.deliveryAddress,
          note: existing.notes,
          pickup: existing.delivery?.pickup,
          dropoff: existing.delivery?.dropoff,
          distanceKm: existing.delivery?.distanceKm,
          trackingToken: existing.deliveryAgent?.trackingToken,
        });
        await Order.updateOne(
          { _id: order._id },
          {
            $set: bookingUpdateFields(booked.booking, booked.trackingToken),
            $unset: { "delivery.error": "" },
          }
        );
        courier = {
          name: booked.booking.agent.name,
          phone: booked.booking.agent.phone,
          etaMinutes: booked.booking.etaMinutes,
          mock: booked.booking.mock,
        };
      } catch (cause) {
        bookingError =
          cause instanceof Error ? cause.message : "The Yango courier could not be booked";
        // The order stays approved: the shop can retry without losing the sale.
        await Order.updateOne(
          { _id: order._id },
          { $set: { "delivery.stage": "failed", "delivery.error": bookingError.slice(0, 300) } }
        );
      }
    }

    // Shop handed the parcel to the courier.
    if (next === "delivery_in_progress" && existing.deliveryMethod !== "pickup") {
      await Order.updateOne(
        { _id: order._id },
        { $set: { "delivery.dispatchedAt": new Date(), "delivery.stage": "picked_up" } }
      );
    }

    if (next === "delivered") {
      await Order.updateOne(
        { _id: order._id },
        { $set: { "delivery.stage": "delivered", "delivery.deliveredAt": new Date() } }
      );
    }

    if (next === "cancelled") {
      if (existing.deliveryMethod !== "pickup") {
        if (existing.delivery?.externalId) {
          await cancelDelivery(
            existing.delivery.provider === "indrive" ? "indrive" : "yango",
            existing.delivery.externalId
          )
            .then(() => {
              deliveryCancelled = true;
            })
            .catch((error) => console.error("Courier cancellation failed:", error));
        }
        await Order.updateOne(
          { _id: order._id },
          { $set: { "delivery.stage": "cancelled", "delivery.cancelledAt": new Date() } }
        );
      }
      // Anything still in escrow goes back to the customer.
      refunded = await refundOrderPayment(order._id);
    }

    if (next === "completed") {
      // The customer confirmed receipt: release escrow, then record the sale so
      // the shop's numbers and stock are already correct when the page reloads.
      settlement = await settleOrderPayment(order._id);
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
            message: `${shopName} cancelled this order.${refunded ? " Your escrow payment has been refunded." : ""} You can place it again from the shop.`,
            actionUrl: "/customer/orders",
            relatedId: order._id.toString(),
          });
        }
        if (!byShop && shopOwnerId) {
          notices.push({
            userId: shopOwnerId,
            type: "order",
            title: `Order cancelled ${orderRef}`,
            message: `The customer cancelled this order.${deliveryCancelled ? " The courier booking was cancelled." : ""}${refunded ? " The escrow payment was refunded." : ""}`,
            actionUrl: "/shop/orders",
            relatedId: order._id.toString(),
          });
        }
      } else if (next === "approved" && customerId) {
        const pickup = existing.deliveryMethod === "pickup";
        notices.push({
          userId: customerId,
          type: "order",
          title: pickup ? `Ready for pickup ${orderRef}` : `Order confirmed ${orderRef}`,
          message: pickup
            ? `${shopName} confirmed your order and it is ready to collect. Open the order for the shop's Google Maps pin and share your location so they know when you arrive.`
            : courier
              ? `${shopName} confirmed your order. ${courier.name} is riding to the shop now — follow the courier live on your order.`
              : `${shopName} confirmed your order. A Yango courier is being arranged; you will be able to track it from the order.`,
          actionUrl: "/customer/orders",
          relatedId: order._id.toString(),
        });
      } else if (next === "delivery_in_progress" && customerId) {
        notices.push({
          userId: customerId,
          type: "order",
          title: `Order dispatched ${orderRef}`,
          message: `${shopName} handed your parcel to the courier. ${existing.delivery?.trackingUrl ? "Follow the trip in the Yango app or " : ""}open the order to watch it move.`,
          actionUrl: "/customer/orders",
          relatedId: order._id.toString(),
        });
      } else if (next === "delivered") {
        const pickup = existing.deliveryMethod === "pickup";
        if (customerId) {
          notices.push({
            userId: customerId,
            type: "order",
            title: pickup ? `Order handed over ${orderRef}` : `Order delivered ${orderRef}`,
            message: pickup
              ? `${shopName} handed over your order. Confirm you collected it to close the sale.`
              : `Your order from ${shopName} arrived. Confirm you received the parcel to release the payment.`,
            actionUrl: "/customer/orders",
            relatedId: order._id.toString(),
          });
        }
        if (shopOwnerId) {
          notices.push({
            userId: shopOwnerId,
            type: "order",
            title: pickup ? `Goods handed over ${orderRef}` : `Order delivered ${orderRef}`,
            message: pickup
              ? "You marked the goods as handed over. Waiting for the customer to confirm the sale."
              : "The courier completed this trip. Waiting for the customer to confirm receipt.",
            actionUrl: "/shop/orders",
            relatedId: order._id.toString(),
          });
        }
      } else if (next === "completed" && shopOwnerId) {
        const payoutNote = settlement
          ? settlement.cash
            ? `Cash of K${settlement.amount.toLocaleString()} marked collected.`
            : settlement.status === "released"
              ? `K${settlement.shopPayout.toLocaleString()} released to you${settlement.courierPayout ? ` and K${settlement.courierPayout.toLocaleString()} paid to the courier` : ""}.`
              : "Payment already settled."
          : "";
        notices.push({
          userId: shopOwnerId,
          type: "order",
          title: `Order completed ${orderRef}`,
          message: `The customer confirmed receipt. Sale of K${Number(order.total).toLocaleString()} recorded, stock updated. ${payoutNote}`.trim(),
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

    // Re-read so the response reflects the courier booking, dispatch timestamps
    // and settlement that just happened in the steps above.
    const fresh = await Order.findById(id).lean();
    return NextResponse.json({
      order: fresh
        ? {
            ...fresh,
            id: fresh._id.toString(),
            status: normalizeOrderStatus(fresh.status),
          }
        : null,
      courier,
      bookingError,
      refunded,
      deliveryCancelled,
      settlement,
    });
  } catch (error) {
    console.error("Orders PUT error:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
