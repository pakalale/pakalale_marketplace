import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { createNotification } from "@/lib/notifications";
import { getSessionUser } from "@/lib/session";
import { bookingUpdateFields, bookOrderCourier } from "@/lib/delivery/booking";
import { normalizeOrderStatus } from "@/lib/orderStatus";
import Order from "@/models/Order";
import Shop from "@/models/Shop";
import User from "@/models/User";

/**
 * Books (or retries booking) the courier for an approved delivery order. The
 * normal path calls this from the order approval step; this route exists for
 * the shop's "Retry courier booking" button when Yango was unreachable.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser(request);
    if (!session) return NextResponse.json({ error: "Please sign in" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const orderId = body.orderId;
    if (!mongoose.isValidObjectId(orderId)) {
      return NextResponse.json({ error: "Invalid order" }, { status: 400 });
    }

    await connectToDatabase();
    const order = await Order.findById(orderId)
      .select(
        "shopId customerId status deliveryMethod deliveryAddress customerPhone notes delivery deliveryAgent.trackingToken"
      )
      .lean();
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const shop = await Shop.findById(order.shopId).select("name ownerId contact coordinates").lean();
    if (!shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    if (session.role !== "admin" && shop.ownerId.toString() !== session.id) {
      return NextResponse.json({ error: "You cannot book this delivery" }, { status: 403 });
    }
    if (order.deliveryMethod === "pickup") {
      return NextResponse.json({ error: "Pickup orders do not need a courier" }, { status: 400 });
    }
    if (normalizeOrderStatus(order.status) !== "approved") {
      return NextResponse.json({ error: "Confirm the order before booking a courier" }, { status: 409 });
    }
    if (order.delivery?.externalId) {
      return NextResponse.json({ error: "A courier is already booked for this order" }, { status: 409 });
    }

    const customer = await User.findById(order.customerId).select("firstName lastName").lean();
    const customerName =
      [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || "Customer";

    let booked;
    try {
      booked = await bookOrderCourier({
        id: order._id.toString(),
        provider: order.deliveryMethod === "indrive" ? "indrive" : "yango",
        shopName: shop.name,
        shopPhone: shop.contact?.phone,
        customerName,
        customerPhone: order.customerPhone || "",
        deliveryAddress: order.deliveryAddress,
        note: order.notes,
        pickup: order.delivery?.pickup,
        dropoff: order.delivery?.dropoff,
        distanceKm: order.delivery?.distanceKm,
        trackingToken: order.deliveryAgent?.trackingToken,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The courier could not be booked";
      await Order.updateOne({ _id: order._id }, { $set: { "delivery.error": message.slice(0, 300) } });
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const updated = await Order.findByIdAndUpdate(
      order._id,
      {
        $set: bookingUpdateFields(booked.booking, booked.trackingToken),
        $unset: { "delivery.error": "" },
      },
      { new: true }
    ).lean();

    const orderRef = `#${order._id.toString().slice(-6).toUpperCase()}`;
    await createNotification({
      userId: order.customerId.toString(),
      type: "order",
      title: `Courier assigned ${orderRef}`,
      message: `${booked.booking.agent.name} is heading to ${shop.name} to collect your order. Open the order to follow the courier.`,
      actionUrl: "/customer/orders",
      relatedId: order._id.toString(),
    }).catch((error) => console.error("Courier notification failed:", error));

    return NextResponse.json({
      order: updated
        ? { ...updated, id: updated._id.toString(), status: normalizeOrderStatus(updated.status) }
        : null,
      courier: {
        name: booked.booking.agent.name,
        phone: booked.booking.agent.phone,
        etaMinutes: booked.booking.etaMinutes,
        mock: booked.booking.mock,
      },
    });
  } catch (error) {
    console.error("Courier booking error:", error);
    return NextResponse.json({ error: "Could not book the courier" }, { status: 500 });
  }
}
